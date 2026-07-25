#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn submit_and_read_review() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PeerReviewLog, ());
    let client = PeerReviewLogClient::new(&env, &contract_id);

    let reviewer = Address::generate(&env);
    let content_hash = BytesN::from_array(&env, &[1u8; 32]);

    let review_id = client.submit_review(&reviewer, &101u64, &content_hash, &90u32);

    assert_eq!(review_id, 1);
    assert_eq!(client.total_reviews(), 1);
    assert!(client.has_reviewed(&reviewer, &101u64));

    let stored_review = client.get_review(&review_id).unwrap();

    assert_eq!(stored_review.review_id, 1);
    assert_eq!(stored_review.reviewer, reviewer);
    assert_eq!(stored_review.paper_id, 101);
    assert_eq!(stored_review.content_hash, content_hash);
    assert_eq!(stored_review.score, 90);
}

#[test]
fn aggregates_multiple_reviews() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PeerReviewLog, ());
    let client = PeerReviewLogClient::new(&env, &contract_id);

    let first_reviewer = Address::generate(&env);
    let second_reviewer = Address::generate(&env);

    let first_hash = BytesN::from_array(&env, &[2u8; 32]);
    let second_hash = BytesN::from_array(&env, &[3u8; 32]);

    client.submit_review(&first_reviewer, &202u64, &first_hash, &80u32);
    client.submit_review(&second_reviewer, &202u64, &second_hash, &90u32);

    let snapshot = client.paper_snapshot(&202u64);

    assert_eq!(snapshot.paper_id, 202);
    assert_eq!(snapshot.review_count, 2);
    assert_eq!(snapshot.score_sum, 170);
    assert_eq!(snapshot.average_score, 85);
    assert_eq!(client.total_reviews(), 2);
}

#[test]
fn rejects_invalid_score() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PeerReviewLog, ());
    let client = PeerReviewLogClient::new(&env, &contract_id);

    let reviewer = Address::generate(&env);
    let content_hash = BytesN::from_array(&env, &[4u8; 32]);

    assert_eq!(
        client.try_submit_review(&reviewer, &303u64, &content_hash, &101u32),
        Err(Ok(ContractError::InvalidScore))
    );

    assert_eq!(client.total_reviews(), 0);
}

#[test]
fn rejects_zero_paper_id() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PeerReviewLog, ());
    let client = PeerReviewLogClient::new(&env, &contract_id);

    let reviewer = Address::generate(&env);
    let content_hash = BytesN::from_array(&env, &[5u8; 32]);

    assert_eq!(
        client.try_submit_review(&reviewer, &0u64, &content_hash, &75u32),
        Err(Ok(ContractError::InvalidPaperId))
    );

    assert_eq!(client.total_reviews(), 0);
}

#[test]
fn rejects_duplicate_review() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(PeerReviewLog, ());
    let client = PeerReviewLogClient::new(&env, &contract_id);

    let reviewer = Address::generate(&env);
    let first_hash = BytesN::from_array(&env, &[6u8; 32]);
    let second_hash = BytesN::from_array(&env, &[7u8; 32]);

    client.submit_review(&reviewer, &404u64, &first_hash, &88u32);

    assert_eq!(
        client.try_submit_review(&reviewer, &404u64, &second_hash, &92u32),
        Err(Ok(ContractError::DuplicateReview))
    );

    let snapshot = client.paper_snapshot(&404u64);

    assert_eq!(snapshot.review_count, 1);
    assert_eq!(snapshot.score_sum, 88);
    assert_eq!(snapshot.average_score, 88);
    assert_eq!(client.total_reviews(), 1);
}
