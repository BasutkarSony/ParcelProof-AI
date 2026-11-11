import { describe, expect, it } from 'vitest'
import { parseParcelProofVoiceCommand } from '../main.jsx'

describe('ParcelProof voice commands', () => {
  it('recognizes order-list requests in English', () => {
    expect(parseParcelProofVoiceCommand('What needs packing?', 'en-IN')).toEqual({ type: 'pending' })
  })

  it('recognizes packing-list requests in Hindi', () => {
    expect(parseParcelProofVoiceCommand('पैकिंग सूची पढ़ो', 'hi-IN')).toEqual({ type: 'list' })
  })

  it('recognizes product navigation in Telugu', () => {
    expect(parseParcelProofVoiceCommand('ఉత్పత్తులు చూపించు', 'te-IN')).toEqual({ type: 'products' })
  })

  it('extracts a spoken shipment reference', () => {
    expect(parseParcelProofVoiceCommand('Open shipment SHP-BD574E09', 'en-IN')).toEqual({
      type: 'open-order',
      orderId: 'SHP-BD574E09'
    })
  })

  it('keeps dictated review notes separate from workflow commands', () => {
    expect(parseParcelProofVoiceCommand('add note: check the blue floral design', 'en-IN')).toEqual({
      type: 'note',
      text: 'check the blue floral design'
    })
  })

  it('does not convert unrecognized speech into an action', () => {
    expect(parseParcelProofVoiceCommand('send the package now', 'en-IN')).toEqual({ type: 'unknown' })
  })
})
