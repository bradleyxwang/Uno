import { nanoid } from 'nanoid';
import { CardGameArea } from '../types/CoveyTownSocket';
import CardGameAreaController from './CardGameAreaController';

describe('[T2] CardGameAreaController', () => {
  // A valid ConversationAreaController to be reused within the tests
  let testArea: CardGameAreaController;
  let testAreaModel: CardGameArea;
  beforeEach(() => {
    testAreaModel = {
      id: nanoid(),
      nonStartedGames: [],
      ongoingGames: [],
    };
    testArea = new CardGameAreaController(testAreaModel);
  });

  describe('nonStartedGames', () => {
    it('Gets the list of not started games properly', () => {
      expect(testArea.nonStartedGames).toEqual(testAreaModel.nonStartedGames);
    });
  });

  describe('ongoingGames', () => {
    it('Gets the list of not started games properly', () => {
      expect(testArea.nonStartedGames).toEqual(testAreaModel.nonStartedGames);
    });
  });
});
