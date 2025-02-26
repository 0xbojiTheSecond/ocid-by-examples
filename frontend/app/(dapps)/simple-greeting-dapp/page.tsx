"use client";
import React, { useState, useEffect } from "react";
import Web3 from "web3";
import contractJson from "@/contracts/Greeter.sol/Greeter.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoginButton from "@/components/LoginButton";
import { useOCAuth } from "@opencampus/ocid-connect-js";
import { jwtDecode } from "jwt-decode";
import { Contracts } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Add type declarations for window
declare global {
  interface Window {
    ethereum: any;
  }
}

interface DecodedToken {
  edu_username: string;
  eth_address: string;
  [key: string]: any;
}

const App: React.FC = () => {
  const { authState, provider } = useOCAuth();
  const [displayMessage, setDisplayMessage] = useState<string>("");
  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);
  const [contracts, setContracts] = useState<Contracts | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [txnHash, setTxnHash] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [ocidUsername, setOcidUsername] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize Web3 and get user info when authenticated
  useEffect(() => {
    if (authState.idToken) {
      try {
        const decodedToken = jwtDecode<DecodedToken>(authState.idToken);
        setOcidUsername(decodedToken.edu_username);
        
        if (decodedToken.eth_address) {
          setUserAddress(decodedToken.eth_address);
          initializeWeb3();
        }
      } catch (error) {
        console.error("Error decoding token:", error);
        setErrorMessage("Failed to decode OCID token");
      }
    }
  }, [authState.idToken, provider]);

  // Effect to refresh the connection when window.ethereum changes
  useEffect(() => {
    if (window.ethereum) {
      // Set up event listeners for account and chain changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log('accountsChanged', accounts);
        if (accounts.length === 0) {
          // User has disconnected all accounts
          setIsConnected(false);
          setUserAddress(undefined);
          setErrorMessage("Wallet disconnected. Please reconnect.");
        } else {
          // Update the active account
          setUserAddress(accounts[0]);
          setErrorMessage(null);
          // Refresh the connection
          initializeWeb3();
        }
      });

      window.ethereum.on('chainChanged', (chainId: string) => {
        console.log('chainChanged', chainId);
        // Reload the page on chain change as recommended by MetaMask
        window.location.reload();
      });

      window.ethereum.on('connect', (connectInfo: { chainId: string }) => {
        console.log('connect', connectInfo);
        setErrorMessage(null);
      });

      window.ethereum.on('disconnect', (error: { code: number; message: string }) => {
        console.log('disconnect', error);
        setIsConnected(false);
        setErrorMessage("Wallet disconnected. Please reconnect.");
      });
    }

    // Cleanup function
    return () => {
      if (window.ethereum && window.ethereum.removeAllListeners) {
        window.ethereum.removeAllListeners();
      }
    };
  }, []);

  // Add a manual connect function
  const manualConnect = async () => {
    try {
      setStatusMessage("Manually connecting to wallet...");
      setErrorMessage(null);
      
      if (!window.ethereum) {
        setErrorMessage("No wallet extension detected");
        return;
      }
      
      // First, make sure we have the right network
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log("Current chain ID:", chainId);
        
        // If not on Educational Chain (656476 = 0xA02EC)
        if (chainId !== '0xa02ec') {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xa02ec' }],
            });
            console.log("Switched to Educational Chain");
          } catch (switchError) {
            console.error("Failed to switch network:", switchError);
            setErrorMessage("Failed to switch to Educational Chain. Please switch manually in your wallet.");
            return;
          }
        }
      } catch (chainError) {
        console.error("Error checking chain:", chainError);
      }
      
      // Request account access directly without web3
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        setErrorMessage("No accounts available after wallet connection");
        return;
      }
      
      console.log("Connected accounts:", accounts);
      setUserAddress(accounts[0]);
      
      // Now initialize Web3
      await initializeWeb3();
      
      setStatusMessage("Connected successfully!");
    } catch (error) {
      console.error("Manual connect error:", error);
      if (error.code === 4001) {
        setErrorMessage("You rejected the connection request");
      } else {
        setErrorMessage(`Connection error: ${error.message}`);
      }
    }
  };

  // Initialize Web3 with available provider
  const initializeWeb3 = async () => {
    try {
      console.log("Initializing Web3...");
      setErrorMessage(null);
      setStatusMessage("Connecting to blockchain...");
      
      // Check for ethereum provider
      if (!window.ethereum) {
        console.error("No web3 provider detected");
        setErrorMessage("No web3 provider detected. Please install MetaMask or use a compatible browser.");
        setStatusMessage(null);
        throw new Error("No web3 provider");
      }
      
      console.log("Using window.ethereum provider");
      
      // Create web3 instance
      const web3Instance = new Web3(window.ethereum);
      
      try {
        // Check what networks are available before requesting accounts
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log(`Connected to chain ID: ${chainId}`);
        
        // For Educational Chain (if needed)
        if (chainId !== '0xA02EC') { // Chain ID for Educational Chain (656476 in decimal)
          try {
            // Attempt to switch to Educational Chain
            console.log("Attempting to switch to Educational Chain");
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xA02EC' }], // 656476 in hex
            });
            console.log("Successfully switched to Educational Chain");
          } catch (switchError) {
            console.error("Failed to switch networks:", switchError);
            // User might have rejected the network switch
            if (switchError.code === 4001) {
              setErrorMessage("Please allow the network switch to Educational Chain in your wallet.");
              setStatusMessage(null);
              setIsConnected(false);
              return;
            }
          }
        }
        
        // Only request accounts after ensuring correct network
        console.log("Requesting account access");
        setStatusMessage("Requesting wallet access...");
        await window.ethereum.request({ 
          method: 'eth_requestAccounts',
          // This triggers the wallet's permission dialog
        });
        
        // Get connected accounts
        const accounts = await web3Instance.eth.getAccounts();
        console.log("Connected accounts:", accounts);
        
        if (accounts.length === 0) {
          throw new Error("No accounts available");
        }
        
        // If user address from token doesn't match any accounts, use the first available
        if (userAddress && !accounts.includes(userAddress)) {
          console.log(`User address ${userAddress} not found in connected accounts, using ${accounts[0]} instead`);
          setUserAddress(accounts[0]);
        }
        
        setWeb3(web3Instance);
        setIsConnected(true);
        
        // Initialize contract
        const contractAddress = "0x48D2d71e26931a68A496F66d83Ca2f209eA9956E";
        console.log(`Connecting to contract at ${contractAddress}`);
        setStatusMessage("Connecting to contract...");
        
        const Greeter = new web3Instance.eth.Contract(
          contractJson.abi,
          contractAddress
        ) as Contracts;
        
        setContracts(Greeter);
        
        // Test contract connection with a read
        try {
          console.log("Reading current message from contract");
          setStatusMessage("Reading from contract...");
          const currentMessage = await Greeter.methods.read().call();
          console.log("Current contract message:", currentMessage);
          setDisplayMessage(currentMessage);
          setStatusMessage("Connected successfully!");
          setTimeout(() => setStatusMessage(null), 3000);
        } catch (err) {
          console.error("Error reading from contract:", err);
          setErrorMessage("Failed to read from contract. The contract might not be deployed on this network.");
          setStatusMessage(null);
        }
      } catch (err) {
        console.error("Error connecting to wallet:", err);
        
        if (err.code === 4001) {
          // User rejected the request
          setErrorMessage("Connection rejected. Please approve the connection in your wallet.");
        } else {
          setErrorMessage("Failed to connect to wallet. Please check your wallet connection.");
        }
        
        setStatusMessage(null);
        throw err;
      }
    } catch (error) {
      console.error("Failed to initialize web3:", error);
      setIsConnected(false);
      setStatusMessage(null);
    }
  };

  // Read message from contract
  const receive = async () => {
    if (!contracts) {
      setErrorMessage("Contract not initialized");
      return;
    }
    
    try {
      const message = await contracts.methods.read().call();
      setDisplayMessage(message);
      setStatusMessage(`Current message: ${message}`);
    } catch (error) {
      console.error("Failed to read from contract:", error);
      setErrorMessage(`Failed to read from contract: ${error.message}`);
    }
  };

  // Send message to contract
  const send = async () => {
    const getMessage = (document.getElementById("message") as HTMLInputElement).value;
    if (!getMessage.trim()) {
      setErrorMessage("Message cannot be empty");
      return;
    }
    
    setLoading(true);
    setShowMessage(true);
    setErrorMessage(null);
    setStatusMessage("Preparing transaction...");
    
    if (!contracts || !window.ethereum) {
      setErrorMessage("Missing requirements for transaction. Check wallet connection.");
      setLoading(false);
      return;
    }
    
    try {
      // Get the latest accounts to make sure we're using an authorized one
      console.log("Requesting fresh account access...");
      setStatusMessage("Requesting wallet access...");
      
      let currentAccounts;
      try {
        // Request accounts access - this should trigger the wallet's permission dialog
        currentAccounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        console.log("Current authorized accounts:", currentAccounts);
        
        if (!currentAccounts || currentAccounts.length === 0) {
          throw new Error("No accounts available after authorization request");
        }
      } catch (err) {
        console.error("Account authorization error:", err);
        if (err.code === 4001) {
          setErrorMessage("You rejected the connection request. Please approve it in your wallet.");
        } else {
          setErrorMessage(`Wallet authorization failed: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Use the first authorized account
      const activeAccount = currentAccounts[0];
      console.log(`Using account ${activeAccount} for transaction`);
      
      if (userAddress !== activeAccount) {
        console.log(`Switching from ${userAddress} to authorized account ${activeAccount}`);
        setUserAddress(activeAccount);
      }
      
      try {
        // Prepare transaction data
        setStatusMessage("Preparing transaction data...");
        const data = contracts.methods.write(getMessage).encodeABI();
        
        // Create minimal transaction parameters
        const txParams = {
          from: activeAccount,
          to: contracts.options.address,
          data: data
        };
        
        console.log("Sending transaction with parameters:", txParams);
        setStatusMessage("Waiting for wallet confirmation...");
        
        // Send transaction through wallet
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });
        
        console.log("Transaction submitted with hash:", txHash);
        setTxnHash(txHash);
        setStatusMessage(`Transaction sent! Hash: ${txHash.substring(0, 10)}...`);
        
        // Optional: Wait for transaction confirmation
        try {
          setStatusMessage("Waiting for confirmation...");
          await waitForTransaction(web3, txHash);
          setStatusMessage("Transaction confirmed!");
          await receive();
        } catch (waitError) {
          console.warn("Could not confirm transaction:", waitError);
          setStatusMessage("Transaction sent, but confirmation timed out. Check explorer for status.");
        }
      } catch (txError) {
        console.error("Transaction error:", txError);
        
        // Handle different error types
        if (txError.code === 4001) {
          setErrorMessage("You rejected the transaction in your wallet.");
        } else if (txError.code === 4100) {
          setErrorMessage("Wallet authorization issue. Try disconnecting and reconnecting your wallet.");
        } else if (txError.code === -32603) {
          setErrorMessage("Internal error in wallet. Check if you have enough funds for gas.");
        } else {
          setErrorMessage(`Transaction error: ${txError.message}`);
        }
      }
    } catch (error) {
      console.error("General error:", error);
      setErrorMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to wait for transaction confirmation
  const waitForTransaction = async (web3Instance, txHash) => {
    let retries = 20;
    while (retries > 0) {
      const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      retries--;
    }
    throw new Error("Transaction confirmation timeout");
  };

  return (
    <div className="App min-h-screen flex flex-col items-center justify-between">
      <Header />
      <div className="flex flex-col items-center justify-center flex-grow w-full mt-24 px-4">
        <Card className="w-full max-w-2xl p-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-4xl font-bold mt-4">
              📚 Simple Greetings Dapp 📚
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center mt-4 space-y-6">
            {!ocidUsername ? (
              <div className="text-center">
                <p className="mb-4">Connect with OCID to interact with the contract</p>
                <LoginButton />
              </div>
            ) : (
              <div className="text-center text-xl">
                <h1>
                  👉Welcome,{" "}
                  <a href="/user">
                    <strong>{ocidUsername}👈</strong>
                  </a>{" "}
                </h1>
                {userAddress && (
                  <p className="text-sm mt-2">
                    Connected with address: {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
                  </p>
                )}
              </div>
            )}

            {isConnected && (
              <div className="flex flex-col items-center w-full">
                <input
                  type="text"
                  placeholder="Enter a message to put onchain"
                  id="message"
                  className="w-full bg-white rounded border border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-white focus:border-indigo-500 text-base outline-none text-gray-700 px-3 py-2 leading-8 transition-colors duration-200 ease-in-out mb-4"
                />
                <div className="flex space-x-4">
                  <Button
                    className="bg-teal-300 hover:bg-teal-700 text-black font-bold py-1 px-6 rounded"
                    onClick={send}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Send"}
                  </Button>
                  <Button
                    className="bg-teal-300 hover:bg-teal-700 text-black font-bold py-1 px-6 rounded"
                    onClick={receive}
                  >
                    Receive
                  </Button>
                  <Button
                    className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-1 px-6 rounded"
                    onClick={() => {
                      // Disconnect and reconnect
                      setIsConnected(false);
                      setWeb3(undefined);
                      setContracts(undefined);
                      setErrorMessage(null);
                      setStatusMessage("Reconnecting...");
                      
                      // Small delay before reconnecting
                      setTimeout(() => {
                        initializeWeb3();
                      }, 500);
                    }}
                  >
                    Reconnect
                  </Button>
                </div>
                
                {displayMessage && (
                  <div className="mt-4 p-3 bg-gray-100 rounded w-full text-center">
                    <p><strong>Current Message:</strong> {displayMessage}</p>
                  </div>
                )}
                
                {statusMessage && (
                  <div className="mt-4 p-3 bg-blue-50 rounded w-full text-center">
                    <p>{statusMessage}</p>
                  </div>
                )}
                
                {showMessage && txnHash && (
                  <div className="mt-4 p-3 bg-gray-50 rounded w-full text-center">
                    <p className="text-sm">Transaction Hash:</p>
                    <a
                      className="text-teal-500 break-all text-sm"
                      href={`https://opencampus-codex.blockscout.com/tx/${txnHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {txnHash}
                    </a>
                  </div>
                )}
                
                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded w-full text-center">
                    <p className="text-red-600">{errorMessage}</p>
                  </div>
                )}
                
                <div className="mt-8 p-3 bg-gray-50 rounded w-full text-sm border border-gray-200">
                  <p className="font-semibold mb-2">Connection Status:</p>
                  <ul className="space-y-1">
                    <li>Connected: {isConnected ? "✅" : "❌"}</li>
                    <li>OCID Username: {ocidUsername || "Not logged in"}</li>
                    <li>Address: {userAddress || "Not available"}</li>
                    <li>Web3 Provider: {web3 ? "✅" : "❌"}</li>
                    <li>OCID Provider: {provider ? "✅" : "❌"}</li>
                    <li>Contract: {contracts ? "✅" : "❌"}</li>
                  </ul>
                  <div className="mt-3 flex justify-center space-x-2">
                    <Button 
                      onClick={manualConnect}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-3 rounded"
                    >
                      Manual Connect
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsConnected(false);
                        setWeb3(undefined);
                        setContracts(undefined);
                        setErrorMessage(null);
                        setStatusMessage("Reconnecting...");
                        setTimeout(() => {
                          initializeWeb3();
                        }, 500);
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-1 px-3 rounded"
                    >
                      Reconnect
                    </Button>
                    {userAddress && (
                      <Button 
                        onClick={async () => {
                          try {
                            // Simply request account access again
                            const accounts = await window.ethereum.request({
                              method: 'eth_requestAccounts'
                            });
                            console.log("Refreshed accounts:", accounts);
                            setUserAddress(accounts[0]);
                            setStatusMessage("Account refreshed!");
                            setTimeout(() => setStatusMessage(null), 3000);
                          } catch (err) {
                            console.error("Error refreshing account:", err);
                            setErrorMessage("Failed to refresh account");
                          }
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-3 rounded"
                      >
                        Refresh Account
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default App;