import {Mat3} from './matrix';

export class Orientation {
  public static north = 0;
  public static east = 1;
  public static south = 2;
  public static west = 3;
  private ori: number;

  constructor(o: number) {
    this.ori = o % 4;
  }

  public static fromMat3(m: Mat3): Orientation {
    let ori = -1;
    if (m.at(5) > 0.1) {
      ori = 0; // north
    }
    if (m.at(2) > 0.1) {
      ori = 3; // west
    }
    if (m.at(5) < -0.1) {
      ori = 2; // south
    }
    if (m.at(2) < -0.1) {
      ori = 1; // east
    }
    return new Orientation(ori);
  }

  public rotatedBy(rot90DegCount: number): Orientation {
    return new Orientation(this.ori + 4 + rot90DegCount);
  }

  public name(): string {
    switch (this.ori) {
      case Orientation.north:
        return 'north';
      case Orientation.west:
        return 'west';
      case Orientation.south:
        return 'south';
      case Orientation.east:
        return 'east';
    }
  }

  public value(): number {
    return this.ori;
  }

  public isSame(o: Orientation): boolean {
    return this.ori === o.ori;
  }

  public isOpposite(o: Orientation): boolean {
    return !this.isSame(o) && (this.isVertically() && o.isVertically() || this.isHorizontally() && o.isHorizontally());
  }

  public isHorizontally(): boolean {
    return this.ori === Orientation.west || this.ori === Orientation.east;
  }

  public isVertically(): boolean {
    return this.ori === Orientation.north || this.ori === Orientation.south;
  }

  public isNorth(): boolean {
    return this.ori === Orientation.north;
  }

  public isWest(): boolean {
    return this.ori === Orientation.west;
  }

  public isSouth(): boolean {
    return this.ori === Orientation.south;
  }

  public isEast(): boolean {
    return this.ori === Orientation.east;
  }
}

export class Vec2 {
  public x = 0;
  public y = 0;
  private o = new Orientation(Orientation.north);

  constructor(p: [number, number], o?: Orientation) {
    this.x = p[0];
    this.y = p[1];
    if (o) {
      this.o = o;
    }
  }

  public static combine(v1: Vec2, v2: Vec2): Vec2 {
    return new Vec2([v1.x, v2.y], v1.o);
  }

  public static copy(v: Vec2): Vec2 {
    return new Vec2([v.x, v.y], v.o);
  }

  public static null(): Vec2 {
    return new Vec2([0, 0], new Orientation(Orientation.north));
  }

  public translate(t: Vec2): Vec2 {
    this.x += t.x;
    this.y += t.y;
    return this;
  }

  public rotate(rotBy90deg: number): Vec2 {
    rotBy90deg = (4 + rotBy90deg) % 4;
    let x = this.x;
    let y = this.y;
    // rotation to right
    for (let i = 0; i < rotBy90deg; i++) {
      [x, y] = [-y, x];
    }

    this.x = x;
    this.y = y;
    this.o = new Orientation(this.o.value() + rotBy90deg);

    return this;
  }

  public scale(s: number): Vec2 {
    this.x *= s;
    this.y *= s;
    return this;
  }

  public flip(): Vec2 {
    [this.x, this.y] = [this.y, this.x];
    return this;
  }

  public minus(v: Vec2): Vec2 {
    return new Vec2([this.x - v.x, this.y - v.y], this.o);
  }

  public plus(v: Vec2): Vec2 {
    return new Vec2([this.x + v.x, this.y + v.y], this.o);
  }

  public mult(k: number): Vec2 {
    return new Vec2([this.x * k, this.y * k], this.o);
  }

  public div(k: number): Vec2 {
    return this.mult(1 / k);
  }

  public neg(): Vec2 {
    return new Vec2([-this.x, -this.y], this.o);
  }

  public xy(): [number, number] {
    return [this.x, this.y];
  }

  public orient(): Orientation {
    return this.o;
  }
}
