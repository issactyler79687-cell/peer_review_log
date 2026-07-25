import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CA5J2DIS47ZNE27KQQ33QTV3GHM4QI3Q263Y2UBH3OYX7GPNPW5G4UVY";
    };
};
export interface Review {
    content_hash: Buffer;
    paper_id: u64;
    review_id: u32;
    reviewer: string;
    score: u32;
}
export declare const ContractError: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
};
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
    get_review: ({ review_id }: {
        review_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<Review>>>;
    /**
     * Construct and simulate a has_reviewed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    has_reviewed: ({ reviewer, paper_id }: {
        reviewer: string;
        paper_id: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a submit_review transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    submit_review: ({ reviewer, paper_id, content_hash, score }: {
        reviewer: string;
        paper_id: u64;
        content_hash: Buffer;
        score: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>;
    /**
     * Construct and simulate a total_reviews transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    total_reviews: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a paper_snapshot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    paper_snapshot: ({ paper_id }: {
        paper_id: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<PaperSnapshot>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_review: (json: string) => AssembledTransaction<Option<Review>>;
        has_reviewed: (json: string) => AssembledTransaction<boolean>;
        submit_review: (json: string) => AssembledTransaction<Result<number, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        total_reviews: (json: string) => AssembledTransaction<number>;
        paper_snapshot: (json: string) => AssembledTransaction<PaperSnapshot>;
    };
}
