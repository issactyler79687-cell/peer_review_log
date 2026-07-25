#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub review_id: u32,
    pub reviewer: Address,
    pub paper_id: u64,
    pub content_hash: BytesN<32>,
    pub score: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaperSnapshot {
    pub paper_id: u64,
    pub review_count: u32,
    pub score_sum: u32,
    pub average_score: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    TotalReviews,
    Review(u32),
    PaperReviewCount(u64),
    PaperScoreSum(u64),
    HasReviewed(u64, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    InvalidPaperId = 1,
    InvalidScore = 2,
    DuplicateReview = 3,
    ArithmeticOverflow = 4,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewSubmitted {
    #[topic]
    pub paper_id: u64,

    #[topic]
    pub reviewer: Address,

    pub review_id: u32,
    pub content_hash: BytesN<32>,
    pub score: u32,
}

#[contract]
pub struct PeerReviewLog;

#[contractimpl]
impl PeerReviewLog {
    pub fn submit_review(
        env: Env,
        reviewer: Address,
        paper_id: u64,
        content_hash: BytesN<32>,
        score: u32,
    ) -> Result<u32, ContractError> {
        reviewer.require_auth();

        if paper_id == 0 {
            return Err(ContractError::InvalidPaperId);
        }

        if score > 100 {
            return Err(ContractError::InvalidScore);
        }

        let reviewed_key = DataKey::HasReviewed(paper_id, reviewer.clone());

        let already_reviewed: bool = env
            .storage()
            .persistent()
            .get(&reviewed_key)
            .unwrap_or(false);

        if already_reviewed {
            return Err(ContractError::DuplicateReview);
        }

        let current_total: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalReviews)
            .unwrap_or(0);

        let review_id = current_total
            .checked_add(1)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let count_key = DataKey::PaperReviewCount(paper_id);

        let current_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

        let new_count = current_count
            .checked_add(1)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let score_key = DataKey::PaperScoreSum(paper_id);

        let current_score_sum: u32 = env.storage().persistent().get(&score_key).unwrap_or(0);

        let new_score_sum = current_score_sum
            .checked_add(score)
            .ok_or(ContractError::ArithmeticOverflow)?;

        let review = Review {
            review_id,
            reviewer: reviewer.clone(),
            paper_id,
            content_hash: content_hash.clone(),
            score,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Review(review_id), &review);

        env.storage()
            .persistent()
            .set(&DataKey::TotalReviews, &review_id);

        env.storage().persistent().set(&count_key, &new_count);

        env.storage().persistent().set(&score_key, &new_score_sum);

        env.storage().persistent().set(&reviewed_key, &true);

        ReviewSubmitted {
            paper_id,
            reviewer,
            review_id,
            content_hash,
            score,
        }
        .publish(&env);

        Ok(review_id)
    }

    pub fn get_review(env: Env, review_id: u32) -> Option<Review> {
        env.storage().persistent().get(&DataKey::Review(review_id))
    }

    pub fn paper_snapshot(env: Env, paper_id: u64) -> PaperSnapshot {
        let review_count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PaperReviewCount(paper_id))
            .unwrap_or(0);

        let score_sum: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PaperScoreSum(paper_id))
            .unwrap_or(0);

        let average_score = if review_count == 0 {
            0
        } else {
            score_sum / review_count
        };

        PaperSnapshot {
            paper_id,
            review_count,
            score_sum,
            average_score,
        }
    }

    pub fn has_reviewed(env: Env, reviewer: Address, paper_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::HasReviewed(paper_id, reviewer))
            .unwrap_or(false)
    }

    pub fn total_reviews(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalReviews)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
