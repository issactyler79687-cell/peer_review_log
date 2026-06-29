# peer_review_log

## Project Title
peer_review_log

## Project Description
Peer review is the backbone of academic integrity, yet most review records are locked inside closed editorial systems with no public audit trail. `peer_review_log` is a Soroban smart contract that turns each peer review into a permanent, tamper-proof on-chain record, so the existence and content hash of a review can be verified by anyone, at any time, without trusting a central server.

The contract lets a student or reviewer submit a single signed review for each paper (paper_id), attaches a content hash of the review text, and stores an integer score in the 0-100 range. Per-paper aggregates (count and sum of scores) and a global review counter are maintained on-chain, giving downstream clients everything they need to render transparent review dashboards for the classroom.

## Project Vision
The long-term vision is to give every research group, journal club, university course, and student society a shared, censorship-resistant ledger of who reviewed what. By anchoring only the review fingerprint (content_hash) on-chain, the system respects the privacy of in-progress drafts while making the *act* of reviewing provable and publicly auditable. Over time, the same primitive can back peer review for open-source code, grant proposals, conference talks, and student assignments.

## Key Features
- `submit_review(reviewer, paper_id, content_hash, score)` — records a single immutable review per (reviewer, paper_id) pair, emits a `review_submitted` Soroban event, and returns the global review index.
- `view_reviews(paper_id)` — returns the number of reviews submitted for a given paper; safe to call on un-reviewed papers (returns 0).
- `verify_reviewer(reviewer, paper_id)` — returns `true` if a reviewer has already covered a paper, letting frontends disable duplicate submissions.
- `aggregate_score(paper_id)` — returns the sum of all submitted scores for a paper; off-chain clients divide by `view_reviews` to compute the mean.
- `paper_snapshot(paper_id)` — bundles the review count and the score sum in a single call so dashboards only need one round-trip.
- `total_reviews()` — global counter of every review ever submitted, useful for analytics and milestone tracking.
- One-reviewer-one-paper enforcement plus a `require_auth()` signature requirement, so reviews are Sybil-resistant and attributable to a Stellar address.

## Contract

- **Network:** Stellar Testnet (Public)
- **Scope:** education dApp — see `contracts/peer_review_log/src/lib.rs` for the full peer_review_log business logic.
- **Functions exposed:** see `Key Features` above and the `pub fn` list in `lib.rs`.
- **Contract ID:** `CDNDFHMZZ7T7BUOXRNK5P3HAWREK45JFPQEKKWKHPO4ADRVQECA43SKF`
- **Explorer template:** `https://stellar.expert/explorer/testnet/tx/11cf1fee9633d29c8c4dfcc8353ccb4305a7468c87568f9813e89a3275a8f09e`

## Future Scope
- **Persistent storage migration** — move per-review records from instance storage to a `Persistent` storage bucket so individual reviews (not just aggregates) can be queried on-chain at a low cost.
- **Per-reviewer reputation** — track how many reviews each address has submitted and expose a `reputation` getter, so professors and DAO curators can weight reviews by track record.
- **IPFS content anchoring** — accept an IPFS CID in addition to a content hash, and verify it via a Soroban `crypto` helper, so the actual review text is publicly retrievable but not co-located with the ledger.
- **Weighted / categorical scoring** — extend `score` to a struct (e.g. `Originality`, `Clarity`, `Rigor`) so `aggregate_score` can return per-dimension sums, matching real rubrics used in academic peer review.
- **Frontend dashboard** — build a Freighter-connected UI that lists papers, surfaces `view_reviews` and `aggregate_score` for each, and lets authenticated students submit a review in a single click.

## Profile

- **Name:** <!-- Fill github name -->
- **Project:** `peer_review_log` (education)
- **Built with:** Soroban SDK 25, Rust, Stellar Testnet
