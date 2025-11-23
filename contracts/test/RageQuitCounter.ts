import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("RageQuitCounter", function () {
  let rageQuitCounter: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const RageQuitCounterFactory = await ethers.getContractFactory("RageQuitCounter");
    rageQuitCounter = await RageQuitCounterFactory.deploy();
  });

  describe("Deployment", function () {
    it("Should initialize with zero total RageQuits", async function () {
      expect(await rageQuitCounter.totalRageQuits()).to.equal(0);
    });

    it("Should initialize with zero count for all users", async function () {
      expect(await rageQuitCounter.getRageQuitCount(owner.address)).to.equal(0);
      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(0);
    });
  });

  describe("recordRageQuit", function () {
    it("Should increment user's RageQuit count", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(1);
    });

    it("Should increment total RageQuits", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      expect(await rageQuitCounter.totalRageQuits()).to.equal(1);
    });

    it("Should allow multiple RageQuits from same user", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordRageQuit();

      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(3);
      expect(await rageQuitCounter.totalRageQuits()).to.equal(3);
    });

    it("Should track RageQuits separately for different users", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user2).recordRageQuit();

      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(2);
      expect(await rageQuitCounter.getRageQuitCount(user2.address)).to.equal(1);
      expect(await rageQuitCounter.totalRageQuits()).to.equal(3);
    });

    it("Should emit RageQuitRecorded event", async function () {
      await expect(rageQuitCounter.connect(user1).recordRageQuit())
        .to.emit(rageQuitCounter, "RageQuitRecorded")
        .withArgs(user1.address, 1, (await ethers.provider.getBlock("latest"))!.timestamp + 1);
    });
  });

  describe("recordBatchRageQuit", function () {
    it("Should increment count by specified amount", async function () {
      await rageQuitCounter.connect(user1).recordBatchRageQuit(5);
      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(5);
    });

    it("Should increment total RageQuits by specified amount", async function () {
      await rageQuitCounter.connect(user1).recordBatchRageQuit(5);
      expect(await rageQuitCounter.totalRageQuits()).to.equal(5);
    });

    it("Should accumulate with previous RageQuits", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordBatchRageQuit(3);

      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(4);
      expect(await rageQuitCounter.totalRageQuits()).to.equal(4);
    });

    it("Should revert if count is zero", async function () {
      await expect(
        rageQuitCounter.connect(user1).recordBatchRageQuit(0)
      ).to.be.revertedWith("Count must be greater than 0");
    });

    it("Should emit BatchRageQuitRecorded event", async function () {
      await expect(rageQuitCounter.connect(user1).recordBatchRageQuit(5))
        .to.emit(rageQuitCounter, "BatchRageQuitRecorded")
        .withArgs(user1.address, 5, 5, (await ethers.provider.getBlock("latest"))!.timestamp + 1);
    });
  });

  describe("getMyRageQuitCount", function () {
    it("Should return caller's RageQuit count", async function () {
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordRageQuit();

      expect(await rageQuitCounter.connect(user1).getMyRageQuitCount()).to.equal(2);
    });
  });

  describe("Complex scenarios", function () {
    it("Should handle multiple users with mixed single and batch RageQuits", async function () {
      // User1: 2 single + 1 batch of 3 = 5 total
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordRageQuit();
      await rageQuitCounter.connect(user1).recordBatchRageQuit(3);

      // User2: 1 batch of 10 = 10 total
      await rageQuitCounter.connect(user2).recordBatchRageQuit(10);

      expect(await rageQuitCounter.getRageQuitCount(user1.address)).to.equal(5);
      expect(await rageQuitCounter.getRageQuitCount(user2.address)).to.equal(10);
      expect(await rageQuitCounter.totalRageQuits()).to.equal(15);
    });
  });
});
