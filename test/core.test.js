const { expect } = require("chai");
const hre = require("hardhat");
const { web3, deployments, waffle } = hre;
const { provider, deployContract } = waffle

const deployContracts = require("../scripts/deployContracts")
const deployConnector = require("../scripts/deployConnector")
const enableConnector = require("../scripts/enableConnector")

const encodeSpells = require("../scripts/encodeSpells.js")
const expectEvent = require("../scripts/expectEvent")

const getMasterSigner = require("../scripts/getMasterSigner")

const addresses = require("../scripts/constant/addresses");
const abis = require("../scripts/constant/abis");

const compoundArtifact = require("../artifacts/contracts/v2/connectors/test/compound.test.sol/ConnectCompound.json");
const connectAuth = require("../artifacts/contracts/v2/connectors/test/auth.test.sol/ConnectV2Auth.json");
const defaultTest2 = require("../artifacts/contracts/v2/accounts/test/implementation_default.v2.test.sol/InstaAccountV2DefaultImplementationV2.json");
const { ethers } = require("hardhat");

describe("Core", function () {
  const address_zero = "0x0000000000000000000000000000000000000000"
  const ethAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
  const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  const usdcAddr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const maxValue = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

  let
    instaConnectorsV2,
    implementationsMapping,
    instaAccountV2Proxy,
    instaAccountV2ImplM1,
    instaAccountV2ImplM2,
    instaAccountV2DefaultImpl,
    instaAccountV2DefaultImplV2,
    instaIndex

  const instaAccountV2DefaultImplSigs = [
    "enable(address)",
    "disable(address)",
    "isAuth(address)",
  ].map((a) => web3.utils.keccak256(a).slice(0, 10))

  const instaAccountV2DefaultImplSigsV2 = [
    "enable(address)",
    "disable(address)",
    "isAuth(address)",
    "switchShield(bool",
    "shield()"
  ].map((a) => web3.utils.keccak256(a).slice(0, 10))

  const instaAccountV2ImplM1Sigs = [
    "cast(address[],bytes[],address)"
  ].map((a) => web3.utils.keccak256(a).slice(0, 10))

  const instaAccountV2ImplM2Sigs = [
    "castWithFlashloan(address[],bytes[],address)"
  ].map((a) => web3.utils.keccak256(a).slice(0, 10))

  let masterSigner;

  let acountV2DsaM1Wallet0;
  let acountV2DsaM2Wallet0;
  let acountV2DsaDefaultWallet0;
  let acountV2DsaDefaultWalletM2;

  let authV3, authV4, compound, compound2

  const wallets = provider.getWallets()
  let [wallet0, wallet1, wallet2, wallet3] = wallets
  before(async () => {
    const result = await deployContracts()
    instaAccountV2DefaultImpl = result.instaAccountV2DefaultImpl
    instaIndex = result.instaIndex
    instaConnectorsV2 = result.instaConnectorsV2
    implementationsMapping = result.implementationsMapping
    instaAccountV2Proxy = result.instaAccountV2Proxy
    instaAccountV2ImplM1 = result.instaAccountV2ImplM1
    instaAccountV2ImplM2 = result.instaAccountV2ImplM2

    masterSigner = await getMasterSigner()

    instaAccountV2DefaultImplV2 = await deployContract(masterSigner, defaultTest2, [])
  })

  it("Should have contracts deployed.", async function () {
    expect(!!instaConnectorsV2.address).to.be.true;
    expect(!!implementationsMapping.address).to.be.true;
    expect(!!instaAccountV2Proxy.address).to.be.true;
    expect(!!instaAccountV2ImplM1.address).to.be.true;
    expect(!!instaAccountV2ImplM2.address).to.be.true;
  });

  describe("Implementations", function () {

    it("Should add default implementation to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).setDefaultImplementation(instaAccountV2DefaultImpl.address);
      await tx.wait()
      expect(await implementationsMapping.defaultImplementation()).to.be.equal(instaAccountV2DefaultImpl.address);
    });

    it("Should add instaAccountV2ImplM1 sigs to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).addImplementation(instaAccountV2ImplM1.address, instaAccountV2ImplM1Sigs);
      await tx.wait()
      expect(await implementationsMapping.getSigImplementation(instaAccountV2ImplM1Sigs[0])).to.be.equal(instaAccountV2ImplM1.address);
      (await implementationsMapping.getImplementationSigs(instaAccountV2ImplM1.address)).forEach((a, i) => {
        expect(a).to.be.eq(instaAccountV2ImplM1Sigs[i])
      })
    });

    it("Should add instaAccountV2ImplM2 sigs to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).addImplementation(instaAccountV2ImplM2.address, instaAccountV2ImplM2Sigs);
      await tx.wait()
      expect(await implementationsMapping.getSigImplementation(instaAccountV2ImplM2Sigs[0])).to.be.equal(instaAccountV2ImplM2.address);
      (await implementationsMapping.getImplementationSigs(instaAccountV2ImplM2.address)).forEach((a, i) => {
        expect(a).to.be.eq(instaAccountV2ImplM2Sigs[i])
      })
    });

    it("Should add InstaAccountV2Proxy in Index.sol", async function () {
      const tx = await instaIndex.connect(masterSigner).addNewAccount(instaAccountV2Proxy.address, address_zero, address_zero)
      await tx.wait()
      expect(await instaIndex.account(2)).to.be.equal(instaAccountV2Proxy.address);
    });

    it("Should remove instaAccountV2ImplM2 sigs to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).removeImplementation(instaAccountV2ImplM2.address);
      await tx.wait()
      expect(await implementationsMapping.getSigImplementation(instaAccountV2ImplM2Sigs[0])).to.be.equal(address_zero);
      expect((await implementationsMapping.getImplementationSigs(instaAccountV2ImplM2.address)).length).to.be.equal(0);
    });

    it("Should add InstaAccountV2DefaultImplementationV2 sigs to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).addImplementation(instaAccountV2DefaultImplV2.address, instaAccountV2DefaultImplSigsV2);
      await tx.wait()
      expect(await implementationsMapping.getSigImplementation(instaAccountV2DefaultImplSigsV2[0])).to.be.equal(instaAccountV2DefaultImplV2.address);
      (await implementationsMapping.getImplementationSigs(instaAccountV2DefaultImplV2.address)).forEach((a, i) => {
        expect(a).to.be.eq(instaAccountV2DefaultImplSigsV2[i])
      })
    });

    it("Should remove InstaAccountV2DefaultImplementationV2 sigs to mapping.", async function () {
      const tx = await implementationsMapping.connect(masterSigner).removeImplementation(instaAccountV2DefaultImplV2.address);
      await tx.wait()
      expect(await implementationsMapping.getSigImplementation(instaAccountV2DefaultImplSigsV2[0])).to.be.equal(address_zero);
      expect((await implementationsMapping.getImplementationSigs(instaAccountV2DefaultImplV2.address)).length).to.be.equal(0);
    });

    it("Should return default imp.", async function () {
      expect(await implementationsMapping.getImplementation(instaAccountV2ImplM2Sigs[0])).to.be.equal(instaAccountV2DefaultImpl.address);
    });

    after(async () => {
      const tx = await implementationsMapping.connect(masterSigner).addImplementation(instaAccountV2ImplM2.address, instaAccountV2ImplM2Sigs);
      await tx.wait()
    });

  });

  describe("Auth", function () {

    it("Should build DSA v2", async function () {
      const tx = await instaIndex.connect(wallet0).build(wallet0.address, 2, wallet0.address)
      const dsaWalletAddress = "0xc8F3572102748a9956c2dFF6b998bd6250E3264c"
      expect((await tx.wait()).events[1].args.account).to.be.equal(dsaWalletAddress);
      acountV2DsaM1Wallet0 = await ethers.getContractAt("InstaAccountV2ImplementationM1", dsaWalletAddress);
      acountV2DsaM2Wallet0 = await ethers.getContractAt("InstaAccountV2ImplementationM2", dsaWalletAddress);
      acountV2DsaDefaultWallet0 = await ethers.getContractAt("InstaAccountV2DefaultImplementation", dsaWalletAddress);
      acountV2DsaDefaultWalletM2 = await ethers.getContractAt("InstaAccountV2DefaultImplementationV2", dsaWalletAddress);
    });

    it("Should deploy Auth connector", async function () {
      await deployConnector({
        connectorName: "authV2",
        contract: "ConnectV2Auth",
        abi: (await deployments.getArtifact("ConnectV2Auth")).abi
      })
      expect(!!addresses.connectors["authV2"]).to.be.true
      await instaConnectorsV2.connect(masterSigner).toggleConnectors([addresses.connectors["authV2"]])
    });

    it("Should deploy EmitEvent connector", async function () {
      await deployConnector({
        connectorName: "emitEvent",
        contract: "ConnectV2EmitEvent",
        abi: (await deployments.getArtifact("ConnectV2EmitEvent")).abi
      })
      expect(!!addresses.connectors["emitEvent"]).to.be.true
      await instaConnectorsV2.connect(masterSigner).toggleConnectors([addresses.connectors["emitEvent"]])
    });

    it("Should add wallet1 as auth", async function () {
      const spells = {
        connector: "authV2",
        method: "add",
        args: [wallet1.address]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet0).cast(...encodeSpells([spells]), wallet1.address)
      const receipt = await tx.wait()
      const logCastEvent = expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
      const LogAddAuthEvent = expectEvent(receipt, (await deployments.getArtifact("ConnectV2Auth")).abi, "LogAddAuth")
    });

    it("Should add wallet2 as auth", async function () {
      const spells = {
        connector: "authV2",
        method: "add",
        args: [wallet2.address]
      }
      const tx = await acountV2DsaM2Wallet0.connect(wallet1).castWithFlashloan(...encodeSpells([spells]), wallet1.address)
      const receipt = await tx.wait()
      const logCastEvent = expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM2")).abi, "LogCast")
      const LogAddAuthEvent = expectEvent(receipt, (await deployments.getArtifact("ConnectV2Auth")).abi, "LogAddAuth")
    });

    it("Should remove wallet1 as auth", async function () {
      const spells = {
        connector: "authV2",
        method: "remove",
        args: [wallet1.address]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet2).cast(...encodeSpells([spells]), wallet2.address)
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM2")).abi, "LogCast")
      expectEvent(receipt, (await deployments.getArtifact("ConnectV2Auth")).abi, "LogRemoveAuth")
    });

    // This one fails
    it("Should add wallet3 as auth using default implmentation", async function() {
      console.log("uwu", "msg.sender=", wallet0.address, "address(this)=" ,acountV2DsaDefaultWallet0.address)
      const tx = await acountV2DsaDefaultWallet0.connect(wallet0).enable(wallet3.address)
      const receipt = await tx.wait()

      expect(await acountV2DsaDefaultWallet0.isAuth(wallet3.address)).to.be.true
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2DefaultImplementation")).abi, "LogEnableUser")
    });

    it("Should remove wallet0 as auth using default implmentation", async function() {
      console.log("uwu", "msg.sender=", wallet0.address, "address(this)=" ,acountV2DsaDefaultWallet0.address)
      const tx = await acountV2DsaDefaultWallet0.connect(wallet3).disable(wallet0.address)
      const receipt = await tx.wait()

      expect(await acountV2DsaDefaultWallet0.isAuth(wallet3.address)).to.be.true
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2DefaultImplementation")).abi, "LogDisableUser")
    });

  });

  describe("Events", function () {

    before(async function () {
      const tx = await instaIndex.connect(wallet0).build(wallet1.address, 2, wallet1.address)
      const dsaWalletAddress = "0x15701ad369a488EA2b89Fa5525e3FD5d96cE40cf"
      expect((await tx.wait()).events[1].args.account).to.be.equal(dsaWalletAddress);

      acountV2DsaM1Wallet0 = await ethers.getContractAt("InstaAccountV2ImplementationM1", dsaWalletAddress);
      acountV2DsaM2Wallet0 = await ethers.getContractAt("InstaAccountV2ImplementationM2", dsaWalletAddress);
      acountV2DsaDefaultWallet0 = await ethers.getContractAt("InstaAccountV2DefaultImplementation", dsaWalletAddress);
    });

    it("Should new connector", async function () {
      await deployConnector({
        connectorName: "authV1",
        contract: "ConnectV2Auth",
        abi: (await deployments.getArtifact("ConnectV2Auth")).abi
      })
      expect(!!addresses.connectors["authV1"]).to.be.true
      await instaConnectorsV2.connect(masterSigner).toggleConnectors([addresses.connectors["authV1"]])
    });

    it("Should emit event from wallet1", async function () {
      const spells = {
        connector: "authV1",
        method: "add",
        args: [wallet3.address]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(...encodeSpells([spells]), wallet3.address)
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
      expectEvent(receipt, (await deployments.getArtifact("ConnectV2Auth")).abi, "LogAddAuth")
    });

    it("Should emit emitEvent", async function () {
      const spells = {
        connector: "emitEvent",
        method: "emitEvent",
        args: []
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(...encodeSpells([spells]), wallet3.address)
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
      expectEvent(receipt, (await deployments.getArtifact("ConnectV2EmitEvent")).abi, "LogEmitEvent")
    })

  });

  describe("Connectors", function() {

    before(async function () {
      compound = await deployContract(masterSigner, compoundArtifact, [])
      authV3 = await deployContract(masterSigner, connectAuth, [])
      authV4 = await deployContract(masterSigner, connectAuth, [])
      compound2 = await deployContract(masterSigner, compoundArtifact, [])
    })

    it("Connector toggle should work", async function () {
      const connectorsArray = [authV3.address]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false;

      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true;
    });

    it("Multiple connectors can be toggled", async function () {
      const connectorsArray = [ authV4.address, compound.address ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    });

    it("Connector toggle should work 2", async function () {
      const connectorsArray = [authV3.address]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
    });

    it("Multiple connectors can be toggled 2", async function () {
      const connectorsArray = [ authV4.address, compound.address ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
    });

    it("Connector toggle should work 3", async function () {
      const connectorsArray = [authV3.address]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    });

    it("Returns false if one of them is not a connector", async function () {
      const connectorsArray = [ authV3.address, compound2.address ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
    });

    it("Should add chief", async function () {
      expect(await instaConnectorsV2.chief(wallet0.address)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleChief(wallet0.address)
      expect(await instaConnectorsV2.chief(wallet0.address)).to.be.true
    })

    it("New chief can toggle connector", async function() {
      const connectorsArray = [compound2.address]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
      await instaConnectorsV2.connect(wallet0).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
    })

    it("Non-chief cannot toggle", async function() {
      const connectorsArray = [compound2.address]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await expect(instaConnectorsV2.connect(wallet1).toggleConnectors(connectorsArray))
        .to.be.revertedWith('not-an-chief');
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
    })

    it("New chief can add more chief", async function () {
      expect(await instaConnectorsV2.chief(wallet1.address)).to.be.false
      await instaConnectorsV2.connect(wallet0).toggleChief(wallet1.address)
      expect(await instaConnectorsV2.chief(wallet1.address)).to.be.true
    })

    after(async () => {
      const connectorsArray = [ compound.address ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    });

  });

  describe("Connector - Compound", function () {

    before(async () => {
      const connectorsArray = [ addresses.connectors["basic"] ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    })
    
    it("Should be a deployed connector", async function () {
      enableConnector({
        connectorName: "compoundV2",
        address: compound.address,
        abi: (await deployments.getArtifact("ConnectCompound")).abi
      })
      expect(!!addresses.connectors["compoundV2"]).to.be.true

      connectorsArray = [addresses.connectors["compoundV2"]]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    })

    it("Should deposit ETH to wallet", async function () {
      const spells = {
        connector: "basic",
        method: "deposit",
        args: [ 
          ethAddr,
          ethers.utils.parseEther("1.0"),
          0,
          0
        ]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
        { value: ethers.utils.parseEther("1.0") }
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should deposit ETH to Compound", async function () {
      const spells = {
        connector: "compoundV2",
        method: "deposit",
        args: [ 
          ethAddr,
          ethers.utils.parseEther("0.5"),
          0,
          0
        ]
      }

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should deposit ETH to Compound 2", async function () {
      const spells = {
        connector: "compoundV2",
        method: "deposit",
        args: [ 
          ethAddr,
          maxValue,
          0,
          0
        ]
      }

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should Borrow & Payback DAI", async function () {
      const spells = [
        {
          connector: "compoundV2",
          method: "borrow",
          args: [ 
            daiAddr,
            ethers.utils.parseEther("10"),
            0,
            123
          ]
        },
        {
          connector: "compoundV2",
          method: "payback",
          args: [ 
            daiAddr,
            0,
            123,
            0
          ]
        }
      ]

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells(spells),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should withdraw from Compound", async function () {
      const spells = {
        connector: "compoundV2",
        method: "withdraw",
        args: [ 
          ethAddr,
          ethers.utils.parseEther("0.5"),
          0,
          0
        ]
      }

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

  })

  describe("Connector - Uniswap", function () {

    before(async () => {
      const connectorsArray = [ addresses.connectors["uniswap"] ]

      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.false
      await instaConnectorsV2.connect(masterSigner).toggleConnectors(connectorsArray)
      expect(await instaConnectorsV2.isConnector(connectorsArray)).to.be.true
    })

    it("Should deposit ETH to wallet", async function () {
      const spells = {
        connector: "basic",
        method: "deposit",
        args: [ 
          ethAddr,
          ethers.utils.parseEther("5.0"),
          0,
          0
        ]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
        { value: ethers.utils.parseEther("5.0") }
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should swap ETH to DAI", async function () {
      const spells = {
        connector: "uniswap",
        method: "sell",
        args: [ 
          daiAddr,
          ethAddr,
          ethers.utils.parseEther("0.5"),
          0,
          0,
          0
        ]
      }

      const abi = (await deployments.getArtifact("TokenInterface")).abi
      const daiContract = new ethers.Contract(daiAddr, abi, provider)

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.equal(0)

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.not.equal(0)
    })

    it("Should swap DAI to USDC", async function () {
      const abi = (await deployments.getArtifact("TokenInterface")).abi
      const daiContract = new ethers.Contract(daiAddr, abi, provider)
      const usdcContract = new ethers.Contract(usdcAddr, abi, provider)

      const spells = {
        connector: "uniswap",
        method: "sell",
        args: [ 
          usdcAddr,
          daiAddr,
          await daiContract.balanceOf(acountV2DsaM1Wallet0.address),
          0,
          0,
          0
        ]
      }

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.not.equal(0)
      expect(await usdcContract.balanceOf(acountV2DsaM1Wallet0.address)).to.equal(0)

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.equal(0)
      expect(await usdcContract.balanceOf(acountV2DsaM1Wallet0.address)).to.not.equal(0)
    })

    it("Should swap ETH to DAI 2", async function () {
      const spells = {
        connector: "uniswap",
        method: "sell",
        args: [ 
          daiAddr,
          ethAddr,
          ethers.utils.parseEther("0.5"),
          0,
          0,
          0
        ]
      }

      const abi = (await deployments.getArtifact("TokenInterface")).abi
      const daiContract = new ethers.Contract(daiAddr, abi, provider)

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.equal(0)

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")

      expect(await daiContract.balanceOf(acountV2DsaM1Wallet0.address)).to.not.equal(0)
    })

    it("Should withdraw USDC to Auth Wallet", async function () {
      const abi = (await deployments.getArtifact("TokenInterface")).abi
      const usdcContract = new ethers.Contract(usdcAddr, abi, provider)

      const usdcBalance = await usdcContract.balanceOf(acountV2DsaM1Wallet0.address)
      const withdrawAmt = usdcBalance.div(ethers.BigNumber.from(2))

      expect(await usdcContract.balanceOf(wallet1.address)).to.equal(0)

      const spells = {
        connector: "basic",
        method: "withdraw",
        args: [ 
          usdcAddr,
          withdrawAmt,
          wallet1.address,
          0,
          0
        ]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")

      expect(await usdcContract.balanceOf(wallet1.address)).to.equal(withdrawAmt)
    })

    it("Should deposit USDC back to wallet", async function () {
      const abi = (await deployments.getArtifact("TokenInterface")).abi
      const usdcContract = new ethers.Contract(usdcAddr, abi, provider)

      let tx = await usdcContract.connect(wallet1).approve(acountV2DsaM1Wallet0.address, maxValue)
      await tx.wait()

      const spells = {
        connector: "basic",
        method: "deposit",
        args: [ 
          usdcAddr,
          maxValue,
          0,
          0
        ]
      }
      tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")

      expect(await usdcContract.balanceOf(wallet1.address)).to.equal(0)
    })

  })

  describe("Connector - Compound", function () {

    it("Should deposit USDC to Compound 2", async function () {
      const spells = {
        connector: "compoundV2",
        method: "deposit",
        args: [ 
          usdcAddr,
          maxValue,
          0,
          0
        ]
      }

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should Borrow & Payback ETH", async function () {
      const spells = [
        {
          connector: "compoundV2",
          method: "borrow",
          args: [ 
            ethAddr,
            ethers.utils.parseEther("0.01"),
            0,
            1235
          ]
        },
        {
          connector: "compoundV2",
          method: "payback",
          args: [ 
            ethAddr,
            0,
            1235,
            0
          ]
        }
      ]

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells(spells),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should withdraw USDC from Compound", async function () {
      const spells = {
        connector: "compoundV2",
        method: "withdraw",
        args: [ 
          usdcAddr,
          maxValue,
          0,
          0
        ]
      }

      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

    it("Should withdraw ETH to any address", async function () {
      const spells = {
        connector: "basic",
        method: "withdraw",
        args: [ 
          ethAddr,
          maxValue,
          "0xa6932AE12380fc2D5B2A118381EB1eA59aF40A5a",
          0,
          0
        ]
      }
      const tx = await acountV2DsaM1Wallet0.connect(wallet1).cast(
        ...encodeSpells([spells]),
        wallet3.address,
      )
      const receipt = await tx.wait()
      expectEvent(receipt, (await deployments.getArtifact("InstaAccountV2ImplementationM1")).abi, "LogCast")
    })

  })

});
