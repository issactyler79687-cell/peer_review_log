import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA5J2DIS47ZNE27KQQ33QTV3GHM4QI3Q263Y2UBH3OYX7GPNPW5G4UVY",
  }
} as const


export interface Review {
  content_hash: Buffer;
  paper_id: u64;
  review_id: u32;
  reviewer: string;
  score: u32;
}

export const ContractError = {
  1: {message:"InvalidPaperId"},
  2: {message:"InvalidScore"},
  3: {message:"DuplicateReview"},
  4: {message:"ArithmeticOverflow"}
}


export interface PaperSnapshot {
  average_score: u32;
  paper_id: u64;
  review_count: u32;
  score_sum: u32;
}


export interface Client {
  /**
   * Construct and simulate a get_review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_review: ({review_id}: {review_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Review>>>

  /**
   * Construct and simulate a has_reviewed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  has_reviewed: ({reviewer, paper_id}: {reviewer: string, paper_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a submit_review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_review: ({reviewer, paper_id, content_hash, score}: {reviewer: string, paper_id: u64, content_hash: Buffer, score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a total_reviews transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  total_reviews: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a paper_snapshot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  paper_snapshot: ({paper_id}: {paper_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<PaperSnapshot>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABlJldmlldwAAAAAABQAAAAAAAAAMY29udGVudF9oYXNoAAAD7gAAACAAAAAAAAAACHBhcGVyX2lkAAAABgAAAAAAAAAJcmV2aWV3X2lkAAAAAAAABAAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAVzY29yZQAAAAAAAAQ=",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAEAAAAAAAAAA5JbnZhbGlkUGFwZXJJZAAAAAAAAQAAAAAAAAAMSW52YWxpZFNjb3JlAAAAAgAAAAAAAAAPRHVwbGljYXRlUmV2aWV3AAAAAAMAAAAAAAAAEkFyaXRobWV0aWNPdmVyZmxvdwAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAADVBhcGVyU25hcHNob3QAAAAAAAAEAAAAAAAAAA1hdmVyYWdlX3Njb3JlAAAAAAAABAAAAAAAAAAIcGFwZXJfaWQAAAAGAAAAAAAAAAxyZXZpZXdfY291bnQAAAAEAAAAAAAAAAlzY29yZV9zdW0AAAAAAAAE",
        "AAAABQAAAAAAAAAAAAAAD1Jldmlld1N1Ym1pdHRlZAAAAAABAAAAEHJldmlld19zdWJtaXR0ZWQAAAAFAAAAAAAAAAhwYXBlcl9pZAAAAAYAAAABAAAAAAAAAAhyZXZpZXdlcgAAABMAAAABAAAAAAAAAAlyZXZpZXdfaWQAAAAAAAAEAAAAAAAAAAAAAAAMY29udGVudF9oYXNoAAAD7gAAACAAAAAAAAAAAAAAAAVzY29yZQAAAAAAAAQAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAKZ2V0X3JldmlldwAAAAAAAQAAAAAAAAAJcmV2aWV3X2lkAAAAAAAABAAAAAEAAAPoAAAH0AAAAAZSZXZpZXcAAA==",
        "AAAAAAAAAAAAAAAMaGFzX3Jldmlld2VkAAAAAgAAAAAAAAAIcmV2aWV3ZXIAAAATAAAAAAAAAAhwYXBlcl9pZAAAAAYAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAANc3VibWl0X3JldmlldwAAAAAAAAQAAAAAAAAACHJldmlld2VyAAAAEwAAAAAAAAAIcGFwZXJfaWQAAAAGAAAAAAAAAAxjb250ZW50X2hhc2gAAAPuAAAAIAAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAQAAA+kAAAAEAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAAAAAAANdG90YWxfcmV2aWV3cwAAAAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAOcGFwZXJfc25hcHNob3QAAAAAAAEAAAAAAAAACHBhcGVyX2lkAAAABgAAAAEAAAfQAAAADVBhcGVyU25hcHNob3QAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_review: this.txFromJSON<Option<Review>>,
        has_reviewed: this.txFromJSON<boolean>,
        submit_review: this.txFromJSON<Result<u32>>,
        total_reviews: this.txFromJSON<u32>,
        paper_snapshot: this.txFromJSON<PaperSnapshot>
  }
}