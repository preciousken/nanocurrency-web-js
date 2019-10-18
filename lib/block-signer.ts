import BigNumber from 'bignumber.js'
import Ed25519 from './ed25519'
import Convert from './util/convert'
import NanoAddress from './nano-address'
import NanoConverter from './nano-converter'

//@ts-ignore
import { blake2b, blake2bInit, blake2bUpdate, blake2bFinal } from 'blakejs'

export default class BlockSigner {

	nanoAddress = new NanoAddress()
	ed25519 = new Ed25519()

	preamble = 0x6.toString().padStart(64, '0')

	receive(data: ReceiveBlock, privateKey: string): SignedBlock {
		const validateInputRaw = (input: string) => !!input && !isNaN(+input)
		if (!validateInputRaw(data.walletBalanceRaw)) {
			throw new Error('Invalid format in wallet balance')
		}

		if (!validateInputRaw(data.amountRaw)) {
			throw new Error('Invalid format in send amount')
		}

		if (!this.nanoAddress.validateNanoAddress(data.toAddress)) {
			throw new Error('Invalid toAddress')
		}

		if (!this.nanoAddress.validateNanoAddress(data.representativeAddress)) {
			throw new Error('Invalid representativeAddress')
		}

		if (!data.transactionHash) {
			throw new Error('No transaction hash')
		}

		if (!data.frontier) {
			throw new Error('No frontier')
		}

		if (!data.work) {
			throw new Error('No work')
		}

		if (!privateKey) {
			throw new Error('Please input the private key to sign the block')
		}

		const balanceNano = NanoConverter.convert(data.walletBalanceRaw, 'RAW', 'NANO')
		const amountNano = NanoConverter.convert(data.amountRaw, 'RAW', 'NANO')
		const newBalanceNano = new BigNumber(balanceNano).plus(new BigNumber(amountNano))
		const newBalanceRaw = NanoConverter.convert(newBalanceNano, 'NANO', 'RAW')
		const newBalanceHex = Convert.dec2hex(newBalanceRaw, 16).toUpperCase()
		const account = this.nanoAddressToHexString(data.toAddress)
		const link = data.transactionHash
		const representative = this.nanoAddressToHexString(data.representativeAddress)

		const signatureBytes = this.ed25519.sign(
			this.generateHash(this.preamble, account, data.frontier, representative, newBalanceHex, link),
			Convert.hex2ab(privateKey))

		return {
			type: 'state',
			account: data.toAddress,
			previous: data.frontier,
			representative: data.representativeAddress,
			balance: newBalanceRaw,
			link: link,
			signature: Convert.ab2hex(signatureBytes),
			work: data.work,
		}
	}

	send(data: SendBlock, privateKey: string): SignedBlock {
		const validateInputRaw = (input: string) => !!input && !isNaN(+input)
		if (!validateInputRaw(data.walletBalanceRaw)) {
			throw new Error('Invalid format in wallet balance')
		}

		if (!validateInputRaw(data.amountRaw)) {
			throw new Error('Invalid format in send amount')
		}

		if (!this.nanoAddress.validateNanoAddress(data.toAddress)) {
			throw new Error('Invalid toAddress')
		}

		if (!this.nanoAddress.validateNanoAddress(data.fromAddress)) {
			throw new Error('Invalid fromAddress')
		}

		if (!this.nanoAddress.validateNanoAddress(data.representativeAddress)) {
			throw new Error('Invalid representativeAddress')
		}

		if (!data.frontier) {
			throw new Error('No frontier')
		}

		if (!data.work) {
			throw new Error('No work')
		}

		if (!privateKey) {
			throw new Error('Please input the private key to sign the block')
		}

		const balanceNano = NanoConverter.convert(data.walletBalanceRaw, 'RAW', 'NANO')
		const amountNano = NanoConverter.convert(data.amountRaw, 'RAW', 'NANO')
		const newBalanceNano = new BigNumber(balanceNano).minus(new BigNumber(amountNano))
		const newBalanceRaw = NanoConverter.convert(newBalanceNano, 'NANO', 'RAW')
		const newBalanceHex = Convert.dec2hex(newBalanceRaw, 16).toUpperCase()
		const account = this.nanoAddressToHexString(data.fromAddress)
		const link = this.nanoAddressToHexString(data.toAddress)
		const representative = this.nanoAddressToHexString(data.representativeAddress)

		const signatureBytes = this.ed25519.sign(
			this.generateHash(this.preamble, account, data.frontier, representative, newBalanceHex, link),
			Convert.hex2ab(privateKey))

		return {
			type: 'state',
			account: data.fromAddress,
			previous: data.frontier,
			representative: data.representativeAddress,
			balance: newBalanceRaw,
			link: link,
			signature: Convert.ab2hex(signatureBytes),
			work: data.work,
		}
	}

	private generateHash(preamble: string, account: string, previous: string, representative: string, balance: string, link: string) {
		const ctx = blake2bInit(32, undefined)
		blake2bUpdate(ctx, Convert.hex2ab(preamble))
		blake2bUpdate(ctx, Convert.hex2ab(account))
		blake2bUpdate(ctx, Convert.hex2ab(previous))
		blake2bUpdate(ctx, Convert.hex2ab(representative))
		blake2bUpdate(ctx, Convert.hex2ab(balance))
		blake2bUpdate(ctx, Convert.hex2ab(link))
		return blake2bFinal(ctx)
	}

	private nanoAddressToHexString(addr: string): string {
		addr = addr.slice(-60)
		const isValid = /^[13456789abcdefghijkmnopqrstuwxyz]+$/.test(addr)
		if (isValid) {
			const keyBytes = this.nanoAddress.decodeNanoBase32(addr.substring(0, 52))
			const hashBytes = this.nanoAddress.decodeNanoBase32(addr.substring(52, 60))
			const blakeHash = blake2b(keyBytes, undefined, 5).reverse()
			if (Convert.ab2hex(hashBytes) == Convert.ab2hex(blakeHash)) {
				const key = Convert.ab2hex(keyBytes).toUpperCase()
				return key
			}
			throw new Error('Checksum mismatch')
		} else {
			throw new Error('Illegal characters')
		}
	}

}

export interface ReceiveBlock {
	walletBalanceRaw: string
	toAddress: string
	transactionHash: string
	frontier: string
	representativeAddress: string
	amountRaw: string
	work: string
}

export interface SendBlock {
	walletBalanceRaw: string
	fromAddress: string
	toAddress: string
	representativeAddress: string
	frontier: string
	amountRaw: string
	work: string
}

export interface RepresentativeBlock {
	walletBalanceRaw: string
	address: string
	representativeAddress: string
	frontier: string
	work: string
}

export interface SignedBlock {
	type: 'state'
	account: string
	previous: string
	representative: string
	balance: string
	link: string
	signature: string
	work: string
}
