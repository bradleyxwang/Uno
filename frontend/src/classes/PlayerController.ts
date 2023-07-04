import EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import { Player as PlayerModel, PlayerLocation } from '../types/CoveyTownSocket';

export type PlayerEvents = {
  movement: (newLocation: PlayerLocation) => void;
};

export type PlayerGameObjects = {
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  label: Phaser.GameObjects.Text;
  locationManagedByGameScene: boolean /* For the local player, the game scene will calculate the current location, and we should NOT apply updates when we receive events */;
};
export default class PlayerController extends (EventEmitter as new () => TypedEmitter<PlayerEvents>) {
  private _location: PlayerLocation;

  private readonly _id: string;

  private readonly _userName: string;

  private _googleEmail?: string;

  private _googleAccountName?: string;

  public gameObjects?: PlayerGameObjects;

  constructor(id: string, userName: string, location: PlayerLocation) {
    super();
    this._id = id;
    this._userName = userName;
    this._location = location;
  }

  set location(newLocation: PlayerLocation) {
    this._location = newLocation;
    this._updateGameComponentLocation();
    this.emit('movement', newLocation);
  }

  get location(): PlayerLocation {
    return this._location;
  }

  get userName(): string {
    return this._userName;
  }

  get id(): string {
    return this._id;
  }

  get googleEmail(): string | undefined {
    return this._googleEmail;
  }

  set googleEmail(value) {
    this._googleEmail = value;
  }

  get googleAccountName(): string | undefined {
    return this._googleAccountName;
  }

  set googleAccountName(value) {
    this._googleAccountName = value;
  }

  toPlayerModel(): PlayerModel {
    return {
      id: this.id,
      userName: this.userName,
      location: this.location,
      googleEmail: this._googleEmail,
      googleAccountName: this._googleAccountName,
    };
  }

  private _updateGameComponentLocation() {
    if (this.gameObjects && !this.gameObjects.locationManagedByGameScene) {
      const { sprite, label } = this.gameObjects;
      if (!sprite.anims) return;
      sprite.setX(this.location.x);
      sprite.setY(this.location.y);
      label.setX(this.location.x);
      label.setY(this.location.y - 20);
      if (this.location.moving) {
        sprite.anims.play(`misa-${this.location.rotation}-walk`, true);
      } else {
        sprite.anims.stop();
        sprite.setTexture('atlas', `misa-${this.location.rotation}`);
      }
    }
  }

  static fromPlayerModel(modelPlayer: PlayerModel): PlayerController {
    return new PlayerController(modelPlayer.id, modelPlayer.userName, modelPlayer.location);
  }

  /**
   * Gets the username of a player given their ID.
   *
   * @param players list of players
   * @param id ID of player we are looking for
   * @returns username of player with the given ID,
   *          or undefined if no such player exists
   */
  static nameFromId(players: PlayerController[], id: string): string | undefined {
    return players.find(player => player.id === id)?.userName;
  }

  /**
   * Gets the google account name of a player given their ID.
   *
   * @param players list of players
   * @param id ID of player we are looking for
   * @returns google account name of player with the given ID,
   *          or undefined if no such player exists
   */
  static googleAccountNameFromId(players: PlayerController[], id: string): string | undefined {
    return players.find(player => player.id === id)?._googleAccountName;
  }
}
