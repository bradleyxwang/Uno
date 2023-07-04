import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import {
  Interactable,
  TownEmitter,
  CardGameArea as CardGameAreaInterface,
} from '../types/CoveyTownSocket';
import TownsStore from '../lib/TownsStore';
import { getLastEmittedEvent, mockPlayer, MockedPlayer, isCardGameArea } from '../TestUtils';
import { TownsController } from './TownsController';
import CardGameArea from './CardGameArea';

type TestTownData = {
  friendlyName: string;
  townID: string;
  isPubliclyListed: boolean;
  townUpdatePassword: string;
};

const broadcastEmitter = jest.fn();
describe('TownsController integration tests', () => {
  let controller: TownsController;

  const createdTownEmitters: Map<string, DeepMockProxy<TownEmitter>> = new Map();
  async function createTownForTesting(
    friendlyNameToUse?: string,
    isPublic = false,
  ): Promise<TestTownData> {
    const friendlyName =
      friendlyNameToUse !== undefined
        ? friendlyNameToUse
        : `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
    const ret = await controller.createTown({
      friendlyName,
      isPubliclyListed: isPublic,
      mapFile: 'testData/indoors.json',
    });
    return {
      friendlyName,
      isPubliclyListed: isPublic,
      townID: ret.townID,
      townUpdatePassword: ret.townUpdatePassword,
    };
  }
  function getBroadcastEmitterForTownID(townID: string) {
    const ret = createdTownEmitters.get(townID);
    if (!ret) {
      throw new Error(`Could not find broadcast emitter for ${townID}`);
    }
    return ret;
  }

  beforeAll(() => {
    // Set the twilio tokens to dummy values so that the unit tests can run
    process.env.TWILIO_API_AUTH_TOKEN = 'testing';
    process.env.TWILIO_ACCOUNT_SID = 'ACtesting';
    process.env.TWILIO_API_KEY_SID = 'testing';
    process.env.TWILIO_API_KEY_SECRET = 'testing';
  });

  beforeEach(async () => {
    createdTownEmitters.clear();
    broadcastEmitter.mockImplementation((townID: string) => {
      const mockRoomEmitter = mockDeep<TownEmitter>();
      createdTownEmitters.set(townID, mockRoomEmitter);
      return mockRoomEmitter;
    });
    TownsStore.initializeTownsStore(broadcastEmitter);
    controller = new TownsController();
    jest.resetModules();
  });

  describe('Interactables', () => {
    let testingTown: TestTownData;
    let player: MockedPlayer;
    let sessionToken: string;
    let interactables: Interactable[];
    beforeEach(async () => {
      testingTown = await createTownForTesting(undefined, true);
      player = mockPlayer(testingTown.townID);
      await controller.joinTown(player.socket);
      const initialData = getLastEmittedEvent(player.socket, 'initialize');
      sessionToken = initialData.sessionToken;
      interactables = initialData.interactables;
    });

    describe('Create Card Game Area', () => {
      it('[OMG3 createPSA] Executes without error when creating a new card game area', async () => {
        const cardGameArea = interactables.find(isCardGameArea) as CardGameAreaInterface;
        if (!cardGameArea) {
          fail('Expected at least one card game area to be returned in the initial join data');
        } else {
          const newCardGameArea = {
            id: cardGameArea.id,
            nonStartedGames: [],
            ongoingGames: [],
          };
          await controller.createCardGameArea(testingTown.townID, sessionToken, newCardGameArea);
          // Check to see that the card game area was successfully updated
          const townEmitter = getBroadcastEmitterForTownID(testingTown.townID);
          const updateMessage = getLastEmittedEvent(townEmitter, 'interactableUpdate');
          if (isCardGameArea(updateMessage)) {
            expect(updateMessage).toEqual(newCardGameArea);
          } else {
            fail('Expected an interactableUpdate to be dispatched with the new card game area');
          }
        }
      });
      it('[OMG3 createPSA] Returns an error message if the town ID is invalid', async () => {
        const cardGameArea = interactables.find(isCardGameArea) as CardGameAreaInterface;
        const newCardGameArea = {
          id: cardGameArea.id,
          nonStartedGames: [],
          ongoingGames: [],
        };
        await expect(
          controller.createCardGameArea(nanoid(), sessionToken, newCardGameArea),
        ).rejects.toThrow();
      });
      it('[OMG3 createPSA] Checks for a valid session token before creating a card game area', async () => {
        const invalidSessionToken = nanoid();
        const cardGameArea = interactables.find(isCardGameArea) as CardGameAreaInterface;
        const newCardGameArea = {
          id: cardGameArea.id,
          nonStartedGames: [],
          ongoingGames: [],
        };
        await expect(
          controller.createCardGameArea(testingTown.townID, invalidSessionToken, newCardGameArea),
        ).rejects.toThrow();
      });
      it('[OMG3 addPSA] Returns an error message if there is no known area with the specified ID', async () => {
        const newCardGameArea = {
          id: nanoid(),
          nonStartedGames: [],
          ongoingGames: [],
        };
        await expect(
          controller.createCardGameArea(testingTown.townID, sessionToken, newCardGameArea),
        ).rejects.toThrow();
      });
    });
    describe('validateCardGameAreaRequest', () => {
      let cardGameArea: CardGameAreaInterface;
      let newCardGameArea: CardGameAreaInterface;

      beforeEach(async () => {
        cardGameArea = interactables.find(isCardGameArea) as CardGameAreaInterface;
        if (!cardGameArea) {
          fail('Expected at least one card game area to be returned in the initial join data');
        } else {
          newCardGameArea = {
            id: cardGameArea.id,
            nonStartedGames: [],
            ongoingGames: [],
          };
          await controller.createCardGameArea(testingTown.townID, sessionToken, newCardGameArea);
        }
      });

      it('Validates a request with a valid town id, session id, and card game id', async () => {
        const cardGameAreaRealAndPlayer = await controller.validateCardGameAreaRequest(
          testingTown.townID,
          newCardGameArea.id,
          sessionToken,
        );
        expect(cardGameAreaRealAndPlayer).toBeDefined();
      });

      it('Throws an error on an invalid town id', async () => {
        await expect(() =>
          controller.validateCardGameAreaRequest(
            'This id does not exist',
            newCardGameArea.id,
            sessionToken,
          ),
        ).toThrowError();
      });

      it('Throws an error on an invalid session id', async () => {
        await expect(() =>
          controller.validateCardGameAreaRequest(
            testingTown.townID,
            newCardGameArea.id,
            'This id does not exist',
          ),
        ).toThrowError();
      });

      it('Throws an error on an card game area id', async () => {
        await expect(() =>
          controller.validateCardGameAreaRequest(
            testingTown.townID,
            'This id does not exist',
            sessionToken,
          ),
        ).toThrowError();
      });
    });

    describe('Interact with existing Card Game Area', () => {
      let cardGameArea: CardGameAreaInterface;
      let newCardGameArea: CardGameAreaInterface;

      beforeEach(async () => {
        cardGameArea = interactables.find(isCardGameArea) as CardGameAreaInterface;
        if (!cardGameArea) {
          fail('Expected at least one card game area to be returned in the initial join data');
        } else {
          newCardGameArea = {
            id: cardGameArea.id,
            nonStartedGames: [],
            ongoingGames: [],
          };
          await controller.createCardGameArea(testingTown.townID, sessionToken, newCardGameArea);
        }
      });

      it('Invokes the "createCardGame" method on "cardGameArea" when calling the "createCardGame" endpoint', async () => {
        const gameId = 'new game';
        const spy = jest
          .spyOn(CardGameArea.prototype, 'createCardGame')
          .mockImplementation(() => gameId);
        const gameIdAfterCreatingNewGame = await controller.createCardGame(
          testingTown.townID,
          newCardGameArea.id,
          sessionToken,
        );
        expect(spy).toBeCalled();
        expect(gameId).toEqual(gameIdAfterCreatingNewGame);
      });

      it('Invokes the "joinCardGame" method on "cardGameArea" when calling the "joinCardGame" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'joinCardGame').mockImplementation();
        await controller.joinCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "joinCardGame" on "cardGameArea" throws an Error when calling the "joinCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'joinCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.joinCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "spectateCardGame" method on "cardGameArea" when calling the "spectateCardGame" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'spectateCardGame').mockImplementation();
        await controller.spectateCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "spectateCardGame" on "cardGameArea" throws an Error when calling the "spectateCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'spectateCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.spectateCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "stopSpectatingCardGame" method on "cardGameArea" when calling the "stopSpectatingCardGame" endpoint', async () => {
        const spy = jest
          .spyOn(CardGameArea.prototype, 'stopSpectatingCardGame')
          .mockImplementation();
        await controller.stopSpectatingCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "stopSpectatingCardGame" on "cardGameArea" throws an Error when calling the "stopSpectatingCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'stopSpectatingCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.stopSpectatingCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "leaveNonStartedCardGame" method on "cardGameArea" when calling the "leaveNonStartedCardGame" endpoint', async () => {
        const spy = jest
          .spyOn(CardGameArea.prototype, 'leaveNonStartedCardGame')
          .mockImplementation();
        await controller.leaveNonStartedCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "leaveNonStartedCardGame" on "cardGameArea" throws an Error when calling the "leaveNonStartedCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'leaveNonStartedCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.leaveNonStartedCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "startCardGame" method on "cardGameArea" when calling the "startCardGame" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'startCardGame').mockImplementation();
        await controller.startCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
          { color: undefined },
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "startCardGame" on "cardGameArea" throws an Error when calling the "startCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'startCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.startCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
            { color: undefined },
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "quitOngoingCardGame" method on "cardGameArea" when calling the "quitOngoingCardGame" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'quitOngoingCardGame').mockImplementation();
        await controller.quitOngoingCardGame(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "quitOngoingCardGame" on "cardGameArea" throws an Error when calling the "quitOngoingCardGame" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'quitOngoingCardGame').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.quitOngoingCardGame(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "cardGamePlayMove" method on "cardGameArea" when calling the "cardGamePlayMove" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'playMove').mockImplementation();
        await controller.cardGamePlayMove(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
          { type: true },
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "cardGamePlayMove" on "cardGameArea" throws an Error when calling the "cardGamePlayMove" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'playMove').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.cardGamePlayMove(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
            { type: true },
          ),
        ).rejects.toThrowError();
      });

      it('Invokes the "cardGameSkipMove" method on "cardGameArea" when calling the "cardGameSkipMove" endpoint', async () => {
        const spy = jest.spyOn(CardGameArea.prototype, 'skipMove').mockImplementation();
        await controller.cardGameSkipMove(
          testingTown.townID,
          newCardGameArea.id,
          'some card game id',
          sessionToken,
        );
        expect(spy).toBeCalled();
      });

      it('Catches an error if "cardGameSkipMove" on "cardGameArea" throws an Error when calling the "cardGameSkipMove" endpoint', async () => {
        jest.spyOn(CardGameArea.prototype, 'skipMove').mockImplementation(() => {
          throw new Error('Error');
        });
        await expect(
          controller.cardGameSkipMove(
            testingTown.townID,
            newCardGameArea.id,
            'some card game id',
            sessionToken,
          ),
        ).rejects.toThrowError();
      });
    });
  });
});
