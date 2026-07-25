import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import type { WalletConnection } from "./services/wallet";
import {
  DappError,
  fetchPaperSnapshot,
  fetchTotalReviews,
  submitPeerReview,
  type DappErrorCategory,
  type PaperSnapshotView,
  type SubmitReviewResult,
} from "./services/contract";
import {
  CONTRACT_ID,
  STELLAR_NETWORK,
  isContractConfigured,
} from "./contractConfig";

type WalletStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

type QueryStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

type TransactionStatus =
  | "idle"
  | "pending"
  | "success"
  | "failed";

interface TransactionFeedback {
  status: TransactionStatus;
  category?: DappErrorCategory;
  message: string;
  result?: SubmitReviewResult;
}

const initialTransactionFeedback: TransactionFeedback = {
  status: "idle",
  message: "No transaction submitted yet.",
};

function shortenAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function parsePositiveInteger(
  value: string,
  fieldName: string,
): bigint {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new DappError(
      "validation",
      `${fieldName} must contain digits only.`,
    );
  }

  const parsed = BigInt(normalized);

  if (parsed <= 0n) {
    throw new DappError(
      "validation",
      `${fieldName} must be greater than zero.`,
    );
  }

  return parsed;
}

function parseScore(value: string): number {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new DappError(
      "validation",
      "Score must be a whole number from 0 to 100.",
    );
  }

  const parsed = Number(normalized);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > 100
  ) {
    throw new DappError(
      "validation",
      "Score must be a whole number from 0 to 100.",
    );
  }

  return parsed;
}

function App() {
  const [wallet, setWallet] =
    useState<WalletConnection | null>(null);

  const [walletStatus, setWalletStatus] =
    useState<WalletStatus>("disconnected");

  const [walletError, setWalletError] = useState("");
  const [contractError, setContractError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  const [totalReviews, setTotalReviews] =
    useState<number | null>(null);

  const [totalReviewsLoading, setTotalReviewsLoading] =
    useState(true);

  const [lookupPaperId, setLookupPaperId] = useState("1");

  const [snapshot, setSnapshot] =
    useState<PaperSnapshotView | null>(null);

  const [queryStatus, setQueryStatus] =
    useState<QueryStatus>("idle");

  const [submitPaperId, setSubmitPaperId] =
    useState("1");

  const [scoreInput, setScoreInput] = useState("80");
  const [reviewText, setReviewText] = useState("");

  const [transaction, setTransaction] =
    useState<TransactionFeedback>(
      initialTransactionFeedback,
    );

  useEffect(() => {
    let active = true;

    async function loadInitialState(): Promise<void> {
      setTotalReviewsLoading(true);

      try {
        const total = await fetchTotalReviews();

        if (active) {
          setTotalReviews(total);
        }
      } catch (error) {
        if (active) {
          setContractError(
            error instanceof Error
              ? error.message
              : "Unable to read contract state.",
          );
        }
      } finally {
        if (active) {
          setTotalReviewsLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      active = false;
    };
  }, []);

  async function handleConnect(): Promise<void> {
    setWalletError("");
    setWalletStatus("connecting");

    try {
      const { connectWallet } =
        await import("./services/wallet");

      const connection = await connectWallet();

      setWallet(connection);
      setWalletStatus("connected");
    } catch (error) {
      setWallet(null);
      setWalletStatus("error");

      setWalletError(
        error instanceof Error
          ? error.message
          : "Unable to connect the wallet.",
      );
    }
  }

  async function handleDisconnect(): Promise<void> {
    try {
      const { disconnectWallet } =
        await import("./services/wallet");

      await disconnectWallet();
    } catch (error) {
      setWalletError(
        error instanceof Error
          ? error.message
          : "Unable to disconnect the wallet.",
      );
    } finally {
      setWallet(null);
      setWalletStatus("disconnected");
    }
  }

  async function refreshContractState(
    paperId: bigint,
  ): Promise<void> {
    const [total, latestSnapshot] = await Promise.all([
      fetchTotalReviews(),
      fetchPaperSnapshot(paperId),
    ]);

    setTotalReviews(total);
    setSnapshot(latestSnapshot);
    setLookupPaperId(paperId.toString());
    setQueryStatus("success");
  }

  async function handlePaperLookup(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setSnapshot(null);
    setContractError("");
    setSyncMessage("");
    setQueryStatus("loading");

    try {
      const paperId = parsePositiveInteger(
        lookupPaperId,
        "Paper ID",
      );

      const result = await fetchPaperSnapshot(paperId);

      setSnapshot(result);
      setQueryStatus("success");
    } catch (error) {
      setContractError(
        error instanceof Error
          ? error.message
          : "Unable to read the paper snapshot.",
      );

      setQueryStatus("error");
    }
  }

  async function handleSubmitReview(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setContractError("");
    setWalletError("");
    setSyncMessage("");

    setTransaction({
      status: "pending",
      message:
        "Preparing the contract transaction. Confirm it in your wallet.",
    });

    try {
      if (!wallet) {
        throw new DappError(
          "wallet",
          "Connect a Stellar wallet before submitting.",
        );
      }

      const paperId = parsePositiveInteger(
        submitPaperId,
        "Paper ID",
      );

      const score = parseScore(scoreInput);

      const result = await submitPeerReview({
        reviewer: wallet.address,
        paperId,
        reviewText,
        score,
      });

      setTransaction({
        status: "success",
        message:
          "Review recorded successfully on Stellar Testnet.",
        result,
      });

      setReviewText("");

      try {
        await refreshContractState(paperId);

        setSyncMessage(
          "Contract state refreshed after the ReviewSubmitted event.",
        );
      } catch (syncError) {
        setSyncMessage(
          syncError instanceof Error
            ? `Transaction succeeded, but refresh failed: ${syncError.message}`
            : "Transaction succeeded, but state refresh failed.",
        );
      }
    } catch (error) {
      const category =
        error instanceof DappError
          ? error.category
          : "contract";

      setTransaction({
        status: "failed",
        category,
        message:
          error instanceof Error
            ? error.message
            : "The transaction failed.",
      });
    }
  }

  const transactionBusy =
    transaction.status === "pending";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Stellar Level 2 dApp
          </p>
          <h1>Peer Review Log</h1>
        </div>

        {wallet ? (
          <div className="wallet-actions">
            <div className="wallet-chip">
              <span className="status-dot" />
              <span>
                {shortenAddress(wallet.address)}
              </span>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={handleDisconnect}
              disabled={transactionBusy}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            className="primary-button"
            type="button"
            onClick={handleConnect}
            disabled={walletStatus === "connecting"}
          >
            {walletStatus === "connecting"
              ? "Connecting..."
              : "Connect Wallet"}
          </button>
        )}
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">
            Transparent academic reviews
          </p>

          <h2>
            Record peer-review evidence on Stellar.
          </h2>

          <p className="hero-description">
            Submit a score and SHA-256 evidence hash through
            a wallet-signed Soroban transaction.
          </p>

          <div className="feature-row">
            <span>Freighter, Albedo, xBull</span>
            <span>Live Testnet state</span>
            <span>ReviewSubmitted event</span>
          </div>
        </div>

        <aside className="runtime-card">
          <div className="runtime-heading">
            <div>
              <p className="card-label">Runtime</p>
              <h3>{STELLAR_NETWORK.name}</h3>
            </div>

            <span className="network-badge">
              TESTNET
            </span>
          </div>

          <dl>
            <div>
              <dt>Wallet</dt>
              <dd>{walletStatus}</dd>
            </div>

            <div>
              <dt>Total reviews</dt>
              <dd>
                {totalReviewsLoading
                  ? "Loading..."
                  : totalReviews ?? "Unavailable"}
              </dd>
            </div>

            <div>
              <dt>Contract</dt>
              <dd>
                {isContractConfigured
                  ? shortenAddress(CONTRACT_ID)
                  : "Not configured"}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {walletError && (
        <section className="notice error" role="alert">
          <strong>Wallet error</strong>
          <p>{walletError}</p>
        </section>
      )}

      {contractError && (
        <section className="notice error" role="alert">
          <strong>Contract read error</strong>
          <p>{contractError}</p>
        </section>
      )}

      {syncMessage && (
        <section className="notice info">
          <strong>State synchronization</strong>
          <p>{syncMessage}</p>
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel submit-panel">
          <p className="card-label">Write transaction</p>
          <h3>Submit a peer review</h3>

          <form
            className="review-form"
            onSubmit={handleSubmitReview}
          >
            <div className="form-row">
              <label>
                <span>Paper ID</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={submitPaperId}
                  onChange={(event) => {
                    setSubmitPaperId(event.target.value);
                  }}
                  disabled={transactionBusy}
                  placeholder="Example: 101"
                />
              </label>

              <label>
                <span>Score (0–100)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={scoreInput}
                  onChange={(event) => {
                    setScoreInput(event.target.value);
                  }}
                  disabled={transactionBusy}
                  placeholder="Example: 85"
                />
              </label>
            </div>

            <label>
              <span>Review content</span>
              <textarea
                value={reviewText}
                onChange={(event) => {
                  setReviewText(event.target.value);
                }}
                disabled={transactionBusy}
                placeholder="Write at least 10 characters. Only its SHA-256 hash is stored on-chain."
                maxLength={2000}
                rows={7}
              />
            </label>

            <div className="form-footer">
              <span>
                {reviewText.length}/2000 characters
              </span>

              <button
                className="primary-button"
                type="submit"
                disabled={transactionBusy}
              >
                {transactionBusy
                  ? "Waiting for wallet..."
                  : wallet
                    ? "Submit review"
                    : "Connect wallet to submit"}
              </button>
            </div>
          </form>
        </article>

        <article
          className={`panel transaction-panel ${transaction.status}`}
        >
          <p className="card-label">
            Transaction status
          </p>
          <h3>{transaction.status}</h3>

          <div className="transaction-state">
            <span className="transaction-indicator" />

            <p>{transaction.message}</p>
          </div>

          {transaction.category && (
            <div className="category-badge">
              Error category: {transaction.category}
            </div>
          )}

          {transaction.result && (
            <dl className="result-list">
              <div>
                <dt>Review ID</dt>
                <dd>{transaction.result.reviewId}</dd>
              </div>

              <div>
                <dt>Transaction hash</dt>
                <dd>
                  {shortenAddress(
                    transaction.result.transactionHash,
                  )}
                </dd>
              </div>

              <div>
                <dt>Content hash</dt>
                <dd>
                  {shortenAddress(
                    transaction.result.contentHash,
                  )}
                </dd>
              </div>
            </dl>
          )}

          {transaction.result && (
            <a
              className="explorer-link"
              href={transaction.result.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View transaction on Stellar Expert
            </a>
          )}
        </article>

        <article className="panel">
          <p className="card-label">Read contract</p>
          <h3>Inspect a paper</h3>

          <form
            className="lookup-form"
            onSubmit={handlePaperLookup}
          >
            <label>
              <span>Paper ID</span>
              <input
                type="text"
                inputMode="numeric"
                value={lookupPaperId}
                onChange={(event) => {
                  setLookupPaperId(event.target.value);
                }}
                disabled={queryStatus === "loading"}
                placeholder="Example: 101"
              />
            </label>

            <button
              className="secondary-button"
              type="submit"
              disabled={queryStatus === "loading"}
            >
              {queryStatus === "loading"
                ? "Reading Testnet..."
                : "Load snapshot"}
            </button>
          </form>
        </article>

        <article className="panel">
          <p className="card-label">Live state</p>
          <h3>Paper snapshot</h3>

          {snapshot ? (
            <div className="snapshot-grid">
              <div>
                <span>Paper ID</span>
                <strong>
                  {snapshot.paperId.toString()}
                </strong>
              </div>

              <div>
                <span>Reviews</span>
                <strong>{snapshot.reviewCount}</strong>
              </div>

              <div>
                <span>Score sum</span>
                <strong>{snapshot.scoreSum}</strong>
              </div>

              <div>
                <span>Average</span>
                <strong>
                  {snapshot.averageScore}/100
                </strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Enter a Paper ID to read its live state.
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export default App;
