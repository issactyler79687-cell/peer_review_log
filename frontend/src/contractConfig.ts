import { TESTNET_DEPLOYMENT } from "./deployment";

export const STELLAR_NETWORK = {
  name: "Stellar Testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
} as const;

const environmentContractId =
  import.meta.env.VITE_CONTRACT_ID?.trim();

export const CONTRACT_ID =
  environmentContractId ||
  TESTNET_DEPLOYMENT.contractId;

export const isContractConfigured =
  /^C[A-Z2-7]{55}$/.test(CONTRACT_ID);
