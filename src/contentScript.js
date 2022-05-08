import { inject } from './broker/utils'
import Script from './broker/Script'
import {
  providerManager,
  ethereumProvider,
  overrideEthereum,
  bitcoinProvider,
  nearProvider,
  paymentUriHandler,
  solanaProvider,
  terraProvider
} from './inject'
import { buildConfig } from '@liquality/wallet-core'
import { ChainNetworks } from '@liquality/wallet-core/dist/utils/networks'
import { chains, isEthereumChain } from '@liquality/cryptoassets'
import PortStream from 'extension-port-stream'
import LocalMessageDuplexStream from 'post-message-stream'
new Script().start()

async function setupTerraStreams() {
  const pageStream = new LocalMessageDuplexStream({
    name: 'station:content',
    target: 'station:inpage'
  })

  const extensionPort = browser.extension.connect({
    name: 'TerraStationExtension'
  })

  const extensionStream = new PortStream(extensionPort)

  extensionStream.pipe(pageStream)
  pageStream.pipe(extensionStream)
  console.log('Stream setup successfully')
}

function injectEthereum(state, chain) {
  const network = ChainNetworks[chain][state.activeNetwork]
  inject(
    ethereumProvider({
      chain,
      asset: chains[chain].nativeAsset,
      network
    })
  )
}

function injectProviders(state) {
  inject(providerManager())
  inject(bitcoinProvider())
  inject(nearProvider())
  inject(solanaProvider())

  setupTerraStreams()
  inject(terraProvider())

  buildConfig.chains.filter(isEthereumChain).forEach((chain) => {
    injectEthereum(state, chain)
  })

  inject(paymentUriHandler())
}

function overrideEthereumInjection(state) {
  const { externalConnections, activeWalletId, activeNetwork } = state

  let ethereumChain = state.injectEthereumChain
  const defaultAccountId = (externalConnections[activeWalletId]?.[origin] || {}).defaultEthereum

  if (defaultAccountId) {
    const defaultAccount = state.accounts[activeWalletId][activeNetwork].find(
      (account) => account.id === defaultAccountId
    )
    if (defaultAccount) {
      const selectedEthereumChain = defaultAccount.chain
      ethereumChain = selectedEthereumChain
    }
  }

  inject(overrideEthereum(ethereumChain))
}

chrome.storage.local.get(['hedera-wallet'], (storage) => {
  const state = storage['hedera-wallet']
  injectProviders(state)

  if (state.injectEthereum && state.injectEthereumChain) {
    overrideEthereumInjection(state)
  }
})
