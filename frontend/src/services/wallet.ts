import { Networks } from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit-tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit-tech/stellar-wallets-kit/modules/xbull";

export interface WalletConnection {
  address: string;
  walletName: string;
}

let walletKitInitialized = false;

function initializeWalletKit(): void {
  if (walletKitInitialized) {
    return;
  }

  StellarWalletsKit.init({
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
    ],
  });

  walletKitInitialized = true;
}

export async function connectWallet(): Promise<WalletConnection> {
  initializeWalletKit();

  try {
    await StellarWalletsKit.authModal();

    const { address } = await StellarWalletsKit.getAddress();

    if (!address) {
      throw new Error(
        "The selected wallet did not return an address.",
      );
    }

    return {
      address,
      walletName: "Stellar wallet",
    };
  } catch (error) {
    throw new Error(normalizeWalletError(error));
  }
}

export async function disconnectWallet(): Promise<void> {
  initializeWalletKit();
  await StellarWalletsKit.disconnect();
}

export async function signWalletTransaction(
  transactionXdr: string,
  address: string,
): Promise<string> {
  initializeWalletKit();

  try {
    const { signedTxXdr } =
      await StellarWalletsKit.signTransaction(
        transactionXdr,
        {
          address,
          networkPassphrase: Networks.TESTNET,
        },
      );

    if (!signedTxXdr) {
      throw new Error(
        "The wallet did not return a signed transaction.",
      );
    }

    return signedTxXdr;
  } catch (error) {
    throw new Error(normalizeWalletError(error));
  }
}

export function normalizeWalletError(
  error: unknown,
): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : String(error);

  const message = rawMessage.toLowerCase();

  if (
    message.includes("reject") ||
    message.includes("declin") ||
    message.includes("cancel")
  ) {
    return "The wallet request was rejected by the user.";
  }

  if (
    message.includes("not found") ||
    message.includes("not installed") ||
    message.includes("unavailable")
  ) {
    return "No supported Stellar wallet was found.";
  }

  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return "The wallet could not connect to Stellar Testnet.";
  }

  return rawMessage || "An unknown wallet error occurred.";
}
