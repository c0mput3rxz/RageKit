import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  console.log("Deploying RageQuitCounter...");

  const rageQuitCounter = await ethers.deployContract("RageQuitCounter");

  const address = await rageQuitCounter.getAddress();
  console.log(`RageQuitCounter deployed to: ${address}`);

  // Verify deployment
  const totalRageQuits = await rageQuitCounter.totalRageQuits();
  console.log(`Initial total RageQuits: ${totalRageQuits}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
