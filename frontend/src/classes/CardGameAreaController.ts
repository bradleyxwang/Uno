import { EventEmitter } from 'events';
import { useEffect, useState } from 'react';
import TypedEventEmitter from 'typed-emitter';
import {
  NonStartedCardGame,
  OngoingCardGame,
  CardGameArea as CardGameAreaModel,
} from '../types/CoveyTownSocket';

/**
 * The events that a CardGameAreaController can emit
 */
export type CardGameAreaEvents = {
  /**
   * A nonStartedGamesChanged event indicates that the list of not started games has changed.
   * Listeners are passed the new list of not started games.
   */
  nonStartedGamesChanged: (games: NonStartedCardGame[]) => void;

  /**
   * A ongoingGamesChanged event indicates that the list of ongoing games has changed.
   * Listeners are passed the new list of ongoing games.
   */
  ongoingGamesChanged: (games: OngoingCardGame[]) => void;
};

/**
 * A CardGameAreaController manages the state for a CardGameArea in the frontend app, serving as a bridge between the
 * CardGameArea's display on the frontend and the backend townService.
 *
 * The CardGameAreaController emits events when the card game area changes.
 */
export default class CardGameAreaController extends (EventEmitter as new () => TypedEventEmitter<CardGameAreaEvents>) {
  private _model: CardGameAreaModel;

  /**
   * Constructs a new CardGameAreaController, initialized with the state of the
   * provided cardGameAreaModel.
   *
   * @param cardGameAreaModel The card game area model that this controller should represent
   */
  constructor(cardGameAreaModel: CardGameAreaModel) {
    super();
    this._model = cardGameAreaModel;
  }

  /**
   * The ID of the card game area represented by this card game area controller
   * This property is read-only: once a CardGameAreaController is created, it will always be
   * tied to the same card game area ID.
   */
  public get id(): string {
    return this._model.id;
  }

  /**
   * The list of not started games assigned to this area.
   */
  public get nonStartedGames(): NonStartedCardGame[] {
    return this._model.nonStartedGames;
  }

  public set nonStartedGames(newGamesList: NonStartedCardGame[]) {
    if (this._model.nonStartedGames !== newGamesList) {
      this._model.nonStartedGames = newGamesList;
      this.emit('nonStartedGamesChanged', this.nonStartedGames);
    }
  }

  /**
   * The list of ongoing games assigned to this area.
   */
  public get ongoingGames(): OngoingCardGame[] {
    return this._model.ongoingGames as OngoingCardGame[];
  }

  public set ongoingGames(newGamesList: OngoingCardGame[]) {
    if (this._model.ongoingGames !== newGamesList) {
      this._model.ongoingGames = newGamesList;
      this.emit('ongoingGamesChanged', this.ongoingGames);
    }
  }

  /**
   * @returns CardGameAreaModel that represents the current state of this CardGameAreaController
   */
  public cardGameAreaModel(): CardGameAreaModel {
    return this._model;
  }

  /**
   * Applies updates to this card game area controller's model, setting the fields
   * nonStartedGames and ongoingGames from the updatedModel
   *
   * @param updatedModel
   */
  public updateFrom(updatedModel: CardGameAreaModel): void {
    // note: this calls the setters; really we're updating the model
    this.nonStartedGames = updatedModel.nonStartedGames;
    this.ongoingGames = updatedModel.ongoingGames as OngoingCardGame[];
  }
}

/**
 * A hook that returns the non-started games for the card game area with the given controller
 */
export function useNonStartedGames(controller: CardGameAreaController): NonStartedCardGame[] {
  const [nonStartedGames, setNonStartedGames] = useState(controller.nonStartedGames);
  useEffect(() => {
    controller.addListener('nonStartedGamesChanged', setNonStartedGames);
    return () => {
      controller.removeListener('nonStartedGamesChanged', setNonStartedGames);
    };
  }, [controller, setNonStartedGames]);
  return nonStartedGames;
}

/**
 * A hook that returns the ongoing games for the card game area with the given controller
 */
export function useOngoingGames(controller: CardGameAreaController): OngoingCardGame[] {
  const [ongoingGames, setOngoingGames] = useState(controller.ongoingGames);
  useEffect(() => {
    controller.addListener('ongoingGamesChanged', setOngoingGames);
    return () => {
      controller.removeListener('ongoingGamesChanged', setOngoingGames);
    };
  }, [controller, setOngoingGames]);
  return ongoingGames;
}
