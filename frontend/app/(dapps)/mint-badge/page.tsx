"use client";
import React, { useState, useEffect } from "react";
import Web3 from "web3";
import contractJson from "@/contracts/BadgeNFT.sol/GithubAvatarNFT.abi.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoginButton from "@/components/LoginButton";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { jwtDecode } from "jwt-decode";
import { Contracts } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MetaMaskConnect } from "@/components/MetaMaskConnect";

interface DecodedToken {
  edu_username: string;
  [key: string]: any;
}

const MintBadge: React.FC = () => {
  const { authState } = useOCAuth();
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [contracts, setContracts] = useState<Contracts | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [txnHash, setTxnHash] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [ocidUsername, setOcidUsername] = useState<string | null>(null);
  const [accountAddress, setAccountAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (authState && authState.idToken) {
      const decodedToken = jwtDecode<DecodedToken>(authState.idToken);
      setOcidUsername(decodedToken.edu_username);
    }
  }, [authState?.idToken]);

  const handleConnect = async (address: string) => {
    try {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      setAccountAddress(address);
      setIsConnected(true);

      const contractAddress = "0x298bF5246a3C927EF0821C39249aFDE31d521257";
      const NFTContract = new web3Instance.eth.Contract(
        contractJson.abi || contractJson,
        contractAddress
      ) as Contracts;
      NFTContract.setProvider(window.ethereum);
      setContracts(NFTContract);
    } catch (error) {
      console.error("Failed to initialize web3 or contract:", error);
    }
  };

  const handleDisconnect = () => {
    setWeb3(undefined);
    setContracts(undefined);
    setAccountAddress(undefined);
    setIsConnected(false);
  };

  const mintNFT = async () => {
    if (!contracts || !accountAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    setLoading(true);
    setShowMessage(true);

    try {
      if (!web3) {
        throw new Error("Web3 is not initialized");
      }

      // Ensure the address is properly formatted
      const formattedAddress = web3.utils.toChecksumAddress(accountAddress);

      // Prepare the transaction data
      const mintTx = contracts.methods.mintNFT(formattedAddress);
      
      // Get current gas price
      const gasPrice = await web3.eth.getGasPrice();
      
      // Send transaction with optimized parameters
      const result = await mintTx.send({ 
        from: accountAddress,
        gasPrice: gasPrice
      }).on("transactionHash", (hash: string) => {
        setTxnHash(hash);
      });

      console.log("NFT Minted:", result);
      alert("NFT minted successfully!");
    } catch (error: any) {
      console.error("Failed to mint NFT:", error);
      let errorMessage = "Failed to mint NFT. ";
      
      if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds in your wallet.";
      } else if (error.message.includes("gas")) {
        errorMessage += "Gas estimation failed. The network might be congested.";
      } else if (error.message.includes("rejected")) {
        errorMessage += "Transaction was rejected.";
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    }

    setLoading(false);
    setTimeout(() => {
      setShowMessage(false);
    }, 3000);
  };

  return (
    <div className="App min-h-screen flex flex-col items-center justify-between">
      <Header />
      <div className="flex flex-col items-center justify-center flex-grow w-full mt-24 px-4">
        <Card className="w-full max-w-2xl p-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-4xl font-bold mt-4">
              🎨 NFT Badge Minting Dapp 🎨
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center mt-4 space-y-6">
            {!ocidUsername && <LoginButton />}
            {ocidUsername && (
              <div className="text-center text-xl">
                <h1>
                  👉Welcome,{" "}
                  <a href="/user">
                    <strong>{ocidUsername}👈</strong>
                  </a>{" "}
                </h1>
              </div>
            )}

            <MetaMaskConnect
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />

            {isConnected && (
              <div className="flex flex-col items-center space-y-4">
                <Button
                  className="bg-teal-400 hover:bg-teal-700 text-black font-bold py-2 px-4 rounded-md"
                  onClick={mintNFT}
                  disabled={loading}
                >
                  {loading ? "Minting..." : "Mint NFT Badge"}
                </Button>
                {showMessage && (
                  <>
                    <p className="text-center text-sm">Minting your NFT badge...</p>
                    {txnHash && (
                      <p className="mt-2 text-xs">
                        Txn hash:{" "}
                        <a
                          className="text-teal-300"
                          href={"https://opencampus-codex.blockscout.com/tx/" + txnHash}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {txnHash}
                        </a>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default MintBadge;