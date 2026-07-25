import { Buffer } from "buffer";
import {
  Client,
  networks,
} from "peer_review_log";
import { STELLAR_NETWORK } from "../contractConfig";

export type DappErrorCategory =
  | "validation"
  | "wallet"
  | "contract"
  | "network";

export class DappError extends Error {
  readonly category: DappErrorCategory;

  constructor(
    category: DappErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = "DappError";
    this.category = category;
  }
}

export interface PaperSnapshotView {
  paperId: bigint;
  reviewCount: number;
  scoreSum: number;
  averageScore: number;
}

export interface SubmitReviewInput {
  reviewer: string;
  paperId: bigint;
  reviewText: string;
  score: number;
}

export interface SubmitReviewResult {
  reviewId: number;
  transactionHash: string;
  explorerUrl: string;
  contentHash: string;
}

const MAX_U64 = (1n << 64n) - 1n;

const readClient = new Client({
  ...networks.testnet,
  rpcUrl: STELLAR_NETWORK.rpcUrl,
});

function toSafeNumber(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    const converted = Number(value);

    if (Number.isSafeInteger(converted)) {
      return converted;
    }
  }

  if (typeof value === "string") {
    const converted = Number(value);

    if (Number.isSafeInteger(converted)) {
      return converted;
    }
  }

  throw new DappError(
    "contract",
    `Contract returned an invalid ${fieldName} value.`,
  );
}

function readField(
  source: Record<string, unknown>,
  snakeCaseName: string,
  camelCaseName: string,
): unknown {
  if (snakeCaseName in source) {
    return source[snakeCaseName];
  }

  if (camelCaseName in source) {
    return source[camelCaseName];
  }

  throw new DappError(
    "contract",
    `Contract response is missing ${snakeCaseName}.`,
  );
}

function validateReviewer(reviewer: string): void {
  if (!/^G[A-Z2-7]{55}$/.test(reviewer)) {
    throw new DappError(
      "validation",
      "Connect a valid Stellar wallet before submitting.",
    );
  }
}

function validatePaperId(paperId: bigint): void {
  if (paperId <= 0n) {
    throw new DappError(
      "validation",
      "Paper ID must be greater than zero.",
    );
  }

  if (paperId > MAX_U64) {
    throw new DappError(
      "validation",
      "Paper ID is larger than the contract allows.",
    );
  }
}

function validateScore(score: number): void {
  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  ) {
    throw new DappError(
      "validation",
      "Score must be a whole number from 0 to 100.",
    );
  }
}

function validateReviewText(reviewText: string): string {
  const normalized = reviewText.trim();

  if (normalized.length < 10) {
    throw new DappError(
      "validation",
      "Review content must contain at least 10 characters.",
    );
  }

  if (normalized.length > 2_000) {
    throw new DappError(
      "validation",
      "Review content cannot exceed 2,000 characters.",
    );
  }

  return normalized;
}

async function hashReviewText(
  reviewText: string,
): Promise<{
  bytes: Buffer;
  hex: string;
}> {
  const encoded =
    new TextEncoder().encode(reviewText);

  /*
   * TypeScript 5.9 distinguishes ArrayBuffer from
   * ArrayBufferLike. Copying the encoded bytes into a new
   * ArrayBuffer gives Web Crypto the exact BufferSource type
   * that crypto.subtle.digest expects.
   */
  const inputBuffer =
    new ArrayBuffer(encoded.byteLength);

  new Uint8Array(inputBuffer).set(encoded);

  const digest =
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      inputBuffer,
    );

  const bytes = Buffer.from(
    new Uint8Array(digest),
  );

  return {
    bytes,
    hex: bytes.toString("hex"),
  };
}

function createWriteClient(reviewer: string): Client {
  return new Client({
    ...networks.testnet,
    rpcUrl: STELLAR_NETWORK.rpcUrl,
    publicKey: reviewer,

    signTransaction: async (
      transactionXdr: string,
    ) => {
      /*
       * Keep wallet code lazy-loaded so the large wallet
       * dependency is fetched only when a signature is needed.
       */
      const { signWalletTransaction } =
        await import("./wallet");

      const signedTxXdr =
        await signWalletTransaction(
          transactionXdr,
          reviewer,
        );

      return {
        signedTxXdr,
        signerAddress: reviewer,
      };
    },
  });
}

export async function fetchTotalReviews(): Promise<number> {
  try {
    const transaction =
      await readClient.total_reviews();

    return toSafeNumber(
      transaction.result,
      "total_reviews",
    );
  } catch (error) {
    throw normalizeDappError(error);
  }
}

export async function fetchPaperSnapshot(
  paperId: bigint,
): Promise<PaperSnapshotView> {
  validatePaperId(paperId);

  try {
    const transaction =
      await readClient.paper_snapshot({
        paper_id: paperId,
      });

    const result =
      transaction.result as unknown as Record<
        string,
        unknown
      >;

    const returnedPaperId = readField(
      result,
      "paper_id",
      "paperId",
    );

    const reviewCount = readField(
      result,
      "review_count",
      "reviewCount",
    );

    const scoreSum = readField(
      result,
      "score_sum",
      "scoreSum",
    );

    const averageScore = readField(
      result,
      "average_score",
      "averageScore",
    );

    return {
      paperId:
        typeof returnedPaperId === "bigint"
          ? returnedPaperId
          : BigInt(String(returnedPaperId)),

      reviewCount: toSafeNumber(
        reviewCount,
        "review_count",
      ),

      scoreSum: toSafeNumber(
        scoreSum,
        "score_sum",
      ),

      averageScore: toSafeNumber(
        averageScore,
        "average_score",
      ),
    };
  } catch (error) {
    throw normalizeDappError(error);
  }
}

export async function submitPeerReview(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  validateReviewer(input.reviewer);
  validatePaperId(input.paperId);
  validateScore(input.score);

  const normalizedReviewText =
    validateReviewText(input.reviewText);

  try {
    const {
      bytes: contentHashBytes,
      hex: contentHash,
    } = await hashReviewText(normalizedReviewText);

    const writeClient =
      createWriteClient(input.reviewer);

    const transaction =
      await writeClient.submit_review({
        reviewer: input.reviewer,
        paper_id: input.paperId,
        content_hash: contentHashBytes,
        score: input.score,
      });

    const sentTransaction =
      await transaction.signAndSend();

    const transactionHash =
      sentTransaction.sendTransactionResponse?.hash;

    if (!transactionHash) {
      throw new DappError(
        "network",
        "The transaction was sent, but its hash was not returned.",
      );
    }

    return {
      reviewId: toSafeNumber(
        sentTransaction.result,
        "review_id",
      ),

      transactionHash,

      explorerUrl:
        `${STELLAR_NETWORK.explorerUrl}` +
        `/tx/${transactionHash}`,

      contentHash,
    };
  } catch (error) {
    throw normalizeDappError(error);
  }
}

export function normalizeDappError(
  error: unknown,
): DappError {
  if (error instanceof DappError) {
    return error;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : String(error);

  const message = rawMessage.toLowerCase();

  if (
    message.includes("reject") ||
    message.includes("declin") ||
    message.includes("cancel") ||
    message.includes("user denied")
  ) {
    return new DappError(
      "wallet",
      "The wallet signature request was rejected.",
    );
  }

  if (
    message.includes("duplicate") ||
    message.includes("#3") ||
    message.includes("error(3)")
  ) {
    return new DappError(
      "contract",
      "This wallet has already reviewed that paper.",
    );
  }

  if (
    message.includes("invalidscore") ||
    message.includes("invalid score") ||
    message.includes("#2") ||
    message.includes("error(2)")
  ) {
    return new DappError(
      "contract",
      "The contract rejected the review score.",
    );
  }

  if (
    message.includes("invalidpaperid") ||
    message.includes("invalid paper") ||
    message.includes("#1") ||
    message.includes("error(1)")
  ) {
    return new DappError(
      "contract",
      "The contract rejected the Paper ID.",
    );
  }

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("rpc")
  ) {
    return new DappError(
      "network",
      "Unable to complete the request on Stellar Testnet.",
    );
  }

  return new DappError(
    "contract",
    rawMessage ||
      "The smart contract transaction failed.",
  );
}
