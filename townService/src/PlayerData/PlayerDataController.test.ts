import { PlayerDataController } from './PlayerDataController';
import { playerEloModel } from './PlayerElo';
import { findPlayerMatchHistory, matchHistoryModel } from './MatchHistory';
import { EloRating, MatchHistory } from '../types/CoveyTownSocket';

describe('PlayerDataController integration tests', () => {
  let controller: PlayerDataController;
  const dummyPlayerID1 = 'testID1';
  const dummyPlayerID2 = 'testID2';
  const dummyPlayerID3 = 'testID3';
  const dummyPlayerElo1 = {
    playerId: dummyPlayerID1,
    username: 'Dummy Username1',
    rating: 1400,
    numPlayed: 40,
  };
  const dummyPlayerElo2 = {
    playerId: dummyPlayerID2,
    username: 'Dummy Username2',
    rating: 1600,
    numPlayed: 60,
  };
  const dummyPlayerElo3 = {
    playerId: dummyPlayerID3,
    username: 'Dummy Username3',
    rating: 1800,
    numPlayed: 80,
  };
  const dummyMatchHistory1 = {
    players: [],
    playingOrder: [],
    spectators: [],
    startTime: 0,
    endTime: 1,
    cardsDrawnDuringGame: [],
    initialHands: [],
    startingTopCardDiscardPile: { type: 'wild' },
    events: [],
  } as MatchHistory;
  const dummyMatchHistory2 = {
    players: [],
    playingOrder: [],
    spectators: [],
    startTime: 0,
    endTime: 1,
    cardsDrawnDuringGame: [],
    initialHands: [],
    startingTopCardDiscardPile: { type: 'wild' },
    events: [],
  } as MatchHistory;

  beforeEach(async () => {
    controller = new PlayerDataController();
  });

  /**
   * Verifies if the 2 elo rating objects have the same fields.
   * @param eloRating1 the first elo rating object to compare
   * @param eloRating2 the second elo rating object to compare
   */
  function doEloRatingsMatch(eloRating1: EloRating, eloRating2: EloRating) {
    expect(eloRating1.playerId).toEqual(eloRating2.playerId);
    expect(eloRating1.username).toEqual(eloRating2.username);
    expect(eloRating1.rating).toEqual(eloRating2.rating);
    expect(eloRating1.numPlayed).toEqual(eloRating2.numPlayed);
  }

  /**
   * Sleeps for the given number of miliseconds
   * @param ms miliseconds to wait for
   */
  function wait(ms: number) {
    const start = new Date().getTime();
    let end = start;
    while (end < start + ms) {
      end = new Date().getTime();
    }
  }

  it('Gets the elo rating for an existing player in the database when calling getPlayerCardGameEloRating', async () => {
    Object.defineProperty(playerEloModel, 'findOne', {
      value: jest.fn(() => dummyPlayerElo1),
      configurable: true,
    });

    const spy = jest.spyOn(playerEloModel, 'findOne');
    const retrievedEloRating = await controller.getPlayerCardGameEloRating(dummyPlayerID1);
    expect(spy).toHaveBeenCalled();
    doEloRatingsMatch(retrievedEloRating, dummyPlayerElo1);
  });

  it('Automatically creates a new elo rating with default values for a player that does not exist in the database when calling getPlayerCardGameEloRating', async () => {
    Object.defineProperty(playerEloModel, 'findOne', {
      value: jest.fn(() => undefined),
      configurable: true,
    });

    const newEloRatingWithDefaultValues = {
      playerId: dummyPlayerID1,
      username: 'Anonymous',
      rating: 1000,
      numPlayed: 0,
    };
    Object.defineProperty(playerEloModel, 'create', {
      value: jest.fn(() => newEloRatingWithDefaultValues),
      configurable: true,
    });

    const spy1 = jest.spyOn(playerEloModel, 'findOne');
    const spy2 = jest.spyOn(playerEloModel, 'create');
    const retrievedEloRating = await controller.getPlayerCardGameEloRating(dummyPlayerID1);
    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
    doEloRatingsMatch(retrievedEloRating, newEloRatingWithDefaultValues);
  });

  it('Gets all the elo ratings from the database when calling getAllCardGameEloRatings', async () => {
    const eloRatingList = [dummyPlayerElo1, dummyPlayerElo2, dummyPlayerElo3];

    Object.defineProperty(playerEloModel, 'find', {
      value: jest.fn(() => eloRatingList),
      configurable: true,
    });

    const spy = jest.spyOn(playerEloModel, 'find');
    const retrievedEloRatings = await controller.getAllCardGameEloRatings();
    expect(spy).toHaveBeenCalled();
    for (let i = 0; i < eloRatingList.length; i++) {
      doEloRatingsMatch(retrievedEloRatings[i], eloRatingList[i]);
    }
  });

  it('Invokes both "findOne" and "updateOne" methods on the playerEloModel when calling updatePlayerCardGameEloRating', async () => {
    Object.defineProperty(playerEloModel, 'findOne', {
      value: jest.fn(() => dummyPlayerElo1),
      configurable: true,
    });
    Object.defineProperty(playerEloModel, 'updateOne', {
      value: jest.fn(),
      configurable: true,
    });

    const spy1 = jest.spyOn(playerEloModel, 'findOne');
    const spy2 = jest.spyOn(playerEloModel, 'updateOne');
    await controller.updatePlayerCardGameEloRating(dummyPlayerID1, dummyPlayerElo2);
    await expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });

  it('Invokes the "deleteMany" method on the playerEloModel when calling deletePlayerCardGameEloRating', async () => {
    Object.defineProperty(playerEloModel, 'deleteMany', {
      value: jest.fn(),
      configurable: true,
    });

    const spy = jest.spyOn(playerEloModel, 'deleteMany');
    await controller.deletePlayerCardGameEloRating(dummyPlayerID1);
    expect(spy).toHaveBeenCalled();
  });

  it('Invokes the "create" method on the matchHistoryModel when calling addNewMatch', async () => {
    Object.defineProperty(matchHistoryModel, 'create', {
      value: jest.fn(),
      configurable: true,
    });

    const spy = jest.spyOn(matchHistoryModel, 'create');
    await controller.addNewMatch(dummyMatchHistory1);
    expect(spy).toHaveBeenCalled();
  });

  it('Gets a list of matches when calling findPlayerMatchHistory (from MatchHistory.ts)', async () => {
    const matches = [dummyMatchHistory1, dummyMatchHistory2];
    Object.defineProperty(matchHistoryModel, 'find', {
      value: jest.fn(() => [dummyMatchHistory1, dummyMatchHistory2]),
      configurable: true,
    });

    const spy = jest.spyOn(matchHistoryModel, 'find');
    const retrievedMatches = await findPlayerMatchHistory(dummyPlayerID1);
    expect(spy).toHaveBeenCalled();
    expect(retrievedMatches).toEqual(matches);
  });
});
