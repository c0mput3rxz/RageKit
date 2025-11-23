import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  // Generate a new random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log("\n=== New Deployment Wallet Generated ===");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("\n⚠️  IMPORTANT: Save the private key securely!");
  console.log("You will need to set it as DEPLOYER_PRIVATE_KEY");
  console.log("\n💰 Send Base ETH to this address:", wallet.address);
  console.log("===================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
