#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

/// Data key for storing per-paper aggregates and the global review index.
/// Using a single enum keeps the storage layout deterministic and easy to
/// reason about when reading from external indexers or the Stellar Expert
/// explorer.
#[contracttype]
#[derive(Clone)]
enum DataKey {
    /// Total number of reviews ever submitted to the log.
    TotalReviews,
    /// Number of reviews that have been submitted for a given paper_id.
    PaperReviewCount(u64),
    /// Sum of all scores that have been submitted for a given paper_id.
    PaperScoreSum(u64),
    /// Whether a given (paper_id, reviewer) tuple has already submitted a
    /// review. Used to prevent double-reviewing and Sybil noise.
    HasReviewed(u64, Address),
}

/// Immutable log of peer reviews on academic work. Once a review is
/// submitted its record is permanently stored on-chain. Students or
/// reviewers can submit, view, and rate reviews transparently.
#[contract]
pub struct PeerReviewLog;

#[contractimpl]
impl PeerReviewLog {
    /// Submit a new peer review for a paper. The reviewer's identity
    /// must be authenticated and they may only review a given paper
    /// once. The score is stored as an integer in the range 0..=100
    /// (interpreted as a percentage by off-chain UIs).
    ///
    /// Returns the global review index assigned to the new review.
    pub fn submit_review(
        env: Env,
        reviewer: Address,
        paper_id: u64,
        content_hash: Symbol,
        score: u32,
    ) -> u32 {
        // The reviewer must sign this transaction with their wallet.
        reviewer.require_auth();

        // Basic validation: score must fit inside a percentage window.
        if score > 100 {
            panic!("score must be between 0 and 100");
        }

        // Prevent a single reviewer from submitting multiple reviews for
        // the same paper — keeps the aggregate score honest.
        let reviewed_key = DataKey::HasReviewed(paper_id, reviewer.clone());
        if env
            .storage()
            .instance()
            .get::<_, bool>(&reviewed_key)
            .unwrap_or(false)
        {
            panic!("reviewer has already reviewed this paper");
        }

        // Mark this reviewer as having reviewed this paper.
        env.storage().instance().set(&reviewed_key, &true);

        // Increment the per-paper review counter.
        let count_key = DataKey::PaperReviewCount(paper_id);
        let current_count: u32 = env
            .storage()
            .instance()
            .get(&count_key)
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&count_key, &(current_count + 1));

        // Add the new score to the per-paper aggregate (capped at u32
        // MAX to avoid overflow — realistic peer review workloads will
        // never approach this).
        let sum_key = DataKey::PaperScoreSum(paper_id);
        let current_sum: u32 = env.storage().instance().get(&sum_key).unwrap_or(0u32);
        let new_sum = current_sum.saturating_add(score);
        env.storage().instance().set(&sum_key, &new_sum);

        // Bump the global review counter and return the new index.
        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalReviews)
            .unwrap_or(0u32);
        let new_total = total + 1;
        env.storage()
            .instance()
            .set(&DataKey::TotalReviews, &new_total);

        // Emit a Soroban event so off-chain indexers / frontends can
        // surface new reviews in real time without polling storage.
        env.events().publish(
            (Symbol::new(&env, "review_submitted"),),
            (paper_id, reviewer, content_hash, score, new_total),
        );

        new_total
    }

    /// Return the number of reviews that have been submitted for a
    /// given paper. Returns 0 if the paper has no reviews yet.
    pub fn view_reviews(env: Env, paper_id: u64) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PaperReviewCount(paper_id))
            .unwrap_or(0u32)
    }

    /// Return `true` if `reviewer` has already submitted a review for
    /// `paper_id`. Useful for frontends that want to disable the
    /// "submit review" button for a paper the user has already covered.
    pub fn verify_reviewer(env: Env, reviewer: Address, paper_id: u64) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::HasReviewed(paper_id, reviewer))
            .unwrap_or(false)
    }

    /// Return the sum of all submitted scores for `paper_id`. Combined
    /// with `view_reviews`, an off-chain client can compute the mean
    /// score for the paper.
    pub fn aggregate_score(env: Env, paper_id: u64) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PaperScoreSum(paper_id))
            .unwrap_or(0u32)
    }

    /// Return the total number of reviews that have ever been
    /// submitted to the contract. Useful for dashboards and analytics.
    pub fn total_reviews(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalReviews)
            .unwrap_or(0u32)
    }

    /// Return a snapshot describing a paper: the number of reviews
    /// and the sum of their scores. Bundling them in one call saves
    /// round-trips for clients that want both values at once.
    pub fn paper_snapshot(env: Env, paper_id: u64) -> (u32, u32) {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PaperReviewCount(paper_id))
            .unwrap_or(0u32);
        let sum: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PaperScoreSum(paper_id))
            .unwrap_or(0u32);
        (count, sum)
    }

    /// Return the list of paper ids that a given reviewer has
    /// participated in. Implemented as a placeholder returning an
    /// empty vec — full indexing is tracked off-chain via the
    /// `review_submitted` event. Kept as part of the public API so
    /// future versions can back it with persistent storage.
    pub fn papers_by_reviewer(_env: Env, _reviewer: Address) -> Vec<u64> {
        Vec::new(&_env)
    }
}
