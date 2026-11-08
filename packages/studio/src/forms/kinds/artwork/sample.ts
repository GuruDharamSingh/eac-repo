// ============================================================================
// Artwork sample (README "Sample content": every name, org and price is made
// up), for the harness's canvas ids 1f and 1p: "Tidewater, No. 3", an etching,
// four pictures, $180, 40 × 50 cm, 2026, an edition. What commerce cannot store
// is left out (the edition size, the variants, a second credit). The ids are
// not real rows; nothing here is ever saved.
// ============================================================================

import type { Answers, FormContext } from '../../contract';
import { SAMPLE_NOW, SAMPLE_PICTURE } from '../post/sample';
import { emptyArtworkAnswers } from './schema';

export const ARTWORK_SAMPLE_CONTEXT: FormContext = {
  orgId: 'sample-eac',
  orgName: 'Elkdonis Arts Collective',
  timeZone: 'America/Toronto',
  now: SAMPLE_NOW,
  // adapters/artwork.ts context(): the store gate, the seller, their store and its currencies.
  fields: {
    canEdit: true,
    reason: null,
    viewerId: 'sample-mara',
    viewerName: 'Mara Okafor',
    storeName: 'Mara Okafor',
    defaultCurrency: 'CAD',
    currencies: ['CAD', 'USD', 'EUR', 'GBP'],
    makerCandidates: [{ userId: 'sample-mara', displayName: 'Mara Okafor' }],
  },
};

export const ARTWORK_SAMPLE: Answers = {
  ...emptyArtworkAnswers(ARTWORK_SAMPLE_CONTEXT),
  title: 'Tidewater, No. 3',
  pictures: [
    { url: SAMPLE_PICTURE, alt: 'Tidewater, No. 3: dark tide lines crossing a pale ground' },
    { url: SAMPLE_PICTURE, alt: 'Detail of the aquatint grain' },
    { url: SAMPLE_PICTURE, alt: 'The print framed in oak' },
    { url: SAMPLE_PICTURE, alt: 'The plate on the press bed' },
  ],
  credits: [{ role: 'artist', userId: 'sample-mara' }],
  price_mode: 'price',
  price: 180,
  currency: 'CAD',
  medium: 'Etching and aquatint on Hahnemühle, 300 gsm',
  height_cm: 40,
  width_cm: 50,
  unit: 'cm',
  year: 2026,
  edition_type: 'edition',
  description: '',
};
