import { createConfig, http } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [base.id]: http(),
  },
});

export const DEGEN_CONTRACT = (process.env.NEXT_PUBLIC_DEGEN_CONTRACT ?? "0x4ed4e862860bed51a9570b96d89af5e1b0efefed") as `0x${string}`;

export const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
  },
] as const;
