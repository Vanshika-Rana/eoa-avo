"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const forwarderABI = [
	{
		inputs: [
			{
				internalType: "address",
				name: "owner_",
				type: "address",
			},
			{
				internalType: "uint32",
				name: "index_",
				type: "uint32",
			},
		],
		name: "computeAvocado",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
];

const forwarderContractAddress = "0x46978CD477A496028A18c02F07ab7F35EDBa5A54";

const tokenInfo = [
	{
		address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		name: "Tether USDT",
	},
	{
		address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
		name: "Polygon USDC",
	},
	{ address: "0xB0bBe7A71162fc57df10c15a5BC74f4caE772782", name: "Arb DAI" },
	{ address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", name: "Opt USDT" },
];

const HomePage = () => {
	const [connected, setConnected] = useState(false);
	const [walletAddress, setWalletAddress] = useState("");
	const [avoWallet, setAvoWallet] = useState("");
	const [walletTokenBalances, setWalletTokenBalances] = useState([]);
	const [avoTokenBalances, setAvoTokenBalances] = useState([]);

	useEffect(() => {
		if (connected) {
			fetchData(walletAddress, setWalletTokenBalances);
			createAvoWallet(walletAddress);
		}
	}, [connected, walletAddress]);

	const connectWallet = async () => {
		if (!connected) {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const _walletAddress = await signer.getAddress();
			setConnected(true);
			setWalletAddress(_walletAddress);
		} else {
			window.ethereum.selectedAddress = null;
			setConnected(false);
			setWalletAddress("");
			setAvoWallet(""); // Reset avoWallet when disconnecting
		}
	};

	const createAvoWallet = async (addr) => {
		const provider = new ethers.JsonRpcProvider(
			"https://polygon.llamarpc.com"
		);
		const contract = new ethers.Contract(
			forwarderContractAddress,
			forwarderABI,
			provider
		);
		const _avoWallet = await contract.computeAvocado(addr, 0);
		setAvoWallet(_avoWallet);
		fetchData(_avoWallet, setAvoTokenBalances);
	};

	const tokenBalanceData = async (_walletAddress, tokenAddr) => {
		const apiKey = process.env.NEXT_PUBLIC_ALCHEMY;
		const fetchURL = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
		const options = {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				id: 1,
				jsonrpc: "2.0",
				method: "alchemy_getTokenBalances",
				params: [`${_walletAddress}`, [`${tokenAddr}`]],
			}),
		};

		const res = await fetch(fetchURL, options);
		const data = await res.json();
		return data.result.tokenBalances[0].tokenBalance;
	};

	const fetchData = async (addr, setTokenBalances) => {
		const tokenBalances = await Promise.all(
			tokenInfo.map(async (token) => {
				const balance = await tokenBalanceData(addr, token.address);
				return {
					name: token.name,
					balance: (
						parseInt(balance) /
						10 ** (token.name.includes("DAI") ? 18 : 6)
					).toFixed(4),
				};
			})
		);

		setTokenBalances(tokenBalances);
	};
	const transferTokens = async () => {
		if (connected && walletAddress && avoWallet) {
			try {
				const provider = new ethers.BrowserProvider(window.ethereum);
				const signer = await provider.getSigner();

				let allTransferAmountsZero = true; // Flag to check if all transfer amounts are zero

				const transferPromises = tokenInfo.map(async (token) => {
					const balance = await tokenBalanceData(
						walletAddress,
						token.address
					);
					const amount = parseInt(balance);
					if (amount > 0) {
						// Transfer only if there's a positive balance
						allTransferAmountsZero = false; // Set the flag to false

						const tokenContract = new ethers.Contract(
							token.address,
							["function transfer(address to, uint256 amount)"],
							signer
						);
						const data = tokenContract.interface.encodeFunctionData(
							"transfer",
							[avoWallet, amount]
						);

						const transaction = {
							from: walletAddress,
							to: token.address,
							value: 0,
							gasPrice: ethers.parseUnits("20", "gwei"),
							gasLimit: 90000,
							data: data,
						};

						const signedTransaction =
							await signer.sendUncheckedTransaction(transaction);

						console.log("Signed Transaction:", signedTransaction);

						console.log(
							`Transferred ${amount} ${token.name} to ${avoWallet}`
						);
					} else {
						console.log(
							`Skipped transfer of ${token.name} as balance is 0`
						);
					}
				});

				await Promise.all(transferPromises);

				if (allTransferAmountsZero) {
					alert("There are no tokens in your EOA to transfer.");
				}

				fetchData(walletAddress, setWalletTokenBalances);
				fetchData(avoWallet, setAvoTokenBalances);
			} catch (error) {
				console.error("Error transferring tokens:", error.message);
			}
		}
	};
	const shortenAddress = (address) => {
		return address
			? `${address.substring(0, 8)}...${address.substring(
					address.length - 4
			  )}`
			: "";
	};
	return (
		<main className='flex flex-col min-h-screen justify-center items-center bg-green-50'>
			<h1 className='text-green-700 font-bold text-5xl mb-4'>
				EOA - AVO Example
			</h1>

			{connected ? (
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					<div className='bg-white px-6 py-6 rounded-xl shadow-md'>
						<h1 className='font-medium text-xl'>
							EOA: {shortenAddress(walletAddress)}
						</h1>
						{walletTokenBalances.map((token, index) => (
							<p key={index} className='font-light text-xl'>
								{token.name}: $ {token.balance}
							</p>
						))}
					</div>
					<div className='bg-white px-6 py-6 rounded-xl shadow-md'>
						<h1 className='font-medium text-xl'>
							Avocado Wallet: {shortenAddress(avoWallet)}
						</h1>
						{avoTokenBalances.map((token, index) => (
							<p key={index} className='font-light text-xl'>
								{token.name}: $ {token.balance}
							</p>
						))}
					</div>
				</div>
			) : (
				<button
					onClick={connectWallet}
					className='bg-green-500 px-5 py-3 rounded-xl text-xl text-white font-bold transition-all ease-in-out duration-300 hover:scale-90 outline-none'>
					Connect Wallet
				</button>
			)}

			{connected && (
				<button
					onClick={transferTokens}
					className='bg-green-600 px-5 py-3 mt-4 rounded-xl text-xl text-white font-bold transition-all ease-in-out duration-300 hover:scale-90 outline-none'>
					Transfer Tokens
				</button>
			)}
		</main>
	);
};

export default HomePage;
