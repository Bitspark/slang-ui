/**
 * @fileoverview TSM - A TypeScript vector and matrix math library
 * @author Matthias Ferch
 * @version 0.6
 */

/*
 * Copyright (c) 2012 Matthias Ferch
 *
 * Project homepage: https://github.com/matthiasferch/tsm
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

const EPSILON = 0.00001;

export class Mat2 {
  static identity = new Mat2().setIdentity();

  private values = new Float32Array(4);

  constructor(values: number[] = null) {
    if (values) {
      this.init(values);
    }
  }

  static product(m1: Mat2, m2: Mat2, result: Mat2 = null): Mat2 {
    const a11 = m1.at(0),
      a12 = m1.at(1),
      a21 = m1.at(2),
      a22 = m1.at(3);

    if (result) {
      result.init([
        a11 * m2.at(0) + a12 * m2.at(2),
        a11 * m2.at(1) + a12 * m2.at(3),
        a21 * m2.at(0) + a22 * m2.at(2),
        a21 * m2.at(1) + a22 * m2.at(3)
      ]);

      return result;
    } else {
      return new Mat2([
        a11 * m2.at(0) + a12 * m2.at(2),
        a11 * m2.at(1) + a12 * m2.at(3),
        a21 * m2.at(0) + a22 * m2.at(2),
        a21 * m2.at(1) + a22 * m2.at(3)
      ]);
    }
  }

  at(index: number): number {
    return this.values[index];
  }

  init(values: number[]): Mat2 {
    for (let i = 0; i < 4; i++) {
      this.values[i] = values[i];
    }

    return this;
  }

  reset(): void {
    for (let i = 0; i < 4; i++) {
      this.values[i] = 0;
    }
  }

  copy(dest: Mat2 = null): Mat2 {
    if (!dest) {
      dest = new Mat2();
    }

    for (let i = 0; i < 4; i++) {
      dest.values[i] = this.values[i];
    }

    return dest;
  }

  all(): number[] {
    const data: number[] = [];
    for (let i = 0; i < 4; i++) {
      data[i] = this.values[i];
    }

    return data;
  }

  row(index: number): number[] {
    return [
      this.values[index * 2 + 0],
      this.values[index * 2 + 1]
    ];
  }

  col(index: number): number[] {
    return [
      this.values[index],
      this.values[index + 2]
    ];
  }

  equals(matrix: Mat2, threshold = EPSILON): boolean {
    for (let i = 0; i < 4; i++) {
      if (Math.abs(this.values[i] - matrix.at(i)) > threshold) {
        return false;
      }
    }

    return true;
  }

  determinant(): number {
    return this.values[0] * this.values[3] - this.values[2] * this.values[1];
  }

  setIdentity(): Mat2 {
    this.values[0] = 1;
    this.values[1] = 0;
    this.values[2] = 0;
    this.values[3] = 1;

    return this;
  }

  transpose(): Mat2 {
    const temp = this.values[1];

    this.values[1] = this.values[2];
    this.values[2] = temp;

    return this;
  }

  inverse(): Mat2 {
    let det = this.determinant();

    if (!det) {
      return null;
    }

    det = 1.0 / det;

    this.values[0] = det * (this.values[3]);
    this.values[1] = det * (-this.values[1]);
    this.values[2] = det * (-this.values[2]);
    this.values[3] = det * (this.values[0]);

    return this;
  }

  multiply(matrix: Mat2): Mat2 {
    const a11 = this.values[0],
      a12 = this.values[1],
      a21 = this.values[2],
      a22 = this.values[3];

    this.values[0] = a11 * matrix.at(0) + a12 * matrix.at(2);
    this.values[1] = a11 * matrix.at(1) + a12 * matrix.at(3);
    this.values[2] = a21 * matrix.at(0) + a22 * matrix.at(2);
    this.values[3] = a21 * matrix.at(1) + a22 * matrix.at(3);

    return this;
  }

  rotate(angle: number): Mat2 {
    const a11 = this.values[0],
      a12 = this.values[1],
      a21 = this.values[2],
      a22 = this.values[3];

    const sin = Math.sin(angle),
      cos = Math.cos(angle);

    this.values[0] = a11 * cos + a12 * sin;
    this.values[1] = a11 * -sin + a12 * cos;
    this.values[2] = a21 * cos + a22 * sin;
    this.values[3] = a21 * -sin + a22 * cos;

    return this;
  }
}

export class Mat3 {
  public static identity = new Mat3().setIdentity();
  private values = new Float32Array(9);

  constructor(values: number[] = null) {
    if (values) {
      this.init(values);
    }
  }


  public static product(m1: Mat3, m2: Mat3, result: Mat3 = null): Mat3 {
    const a00 = m1.at(0), a01 = m1.at(1), a02 = m1.at(2),
      a10 = m1.at(3), a11 = m1.at(4), a12 = m1.at(5),
      a20 = m1.at(6), a21 = m1.at(7), a22 = m1.at(8);

    const b00 = m2.at(0), b01 = m2.at(1), b02 = m2.at(2),
      b10 = m2.at(3), b11 = m2.at(4), b12 = m2.at(5),
      b20 = m2.at(6), b21 = m2.at(7), b22 = m2.at(8);

    if (result) {
      result.init([
        b00 * a00 + b01 * a10 + b02 * a20,
        b00 * a01 + b01 * a11 + b02 * a21,
        b00 * a02 + b01 * a12 + b02 * a22,

        b10 * a00 + b11 * a10 + b12 * a20,
        b10 * a01 + b11 * a11 + b12 * a21,
        b10 * a02 + b11 * a12 + b12 * a22,

        b20 * a00 + b21 * a10 + b22 * a20,
        b20 * a01 + b21 * a11 + b22 * a21,
        b20 * a02 + b21 * a12 + b22 * a22
      ]);

      return result;
    } else {
      return new Mat3([
        b00 * a00 + b01 * a10 + b02 * a20,
        b00 * a01 + b01 * a11 + b02 * a21,
        b00 * a02 + b01 * a12 + b02 * a22,

        b10 * a00 + b11 * a10 + b12 * a20,
        b10 * a01 + b11 * a11 + b12 * a21,
        b10 * a02 + b11 * a12 + b12 * a22,

        b20 * a00 + b21 * a10 + b22 * a20,
        b20 * a01 + b21 * a11 + b22 * a21,
        b20 * a02 + b21 * a12 + b22 * a22
      ]);
    }
  }


  at(index: number): number {
    return this.values[index];
  }

  init(values: number[]): Mat3 {
    for (let i = 0; i < 9; i++) {
      this.values[i] = values[i];
    }

    return this;
  }

  reset(): void {
    for (let i = 0; i < 9; i++) {
      this.values[i] = 0;
    }
  }

  copy(dest: Mat3 = null): Mat3 {
    if (!dest) {
      dest = new Mat3();
    }

    for (let i = 0; i < 9; i++) {
      dest.values[i] = this.values[i];
    }

    return dest;
  }

  all(): number[] {
    const data: number[] = [];
    for (let i = 0; i < 9; i++) {
      data[i] = this.values[i];
    }

    return data;
  }

  row(index: number): number[] {
    return [
      this.values[index * 3 + 0],
      this.values[index * 3 + 1],
      this.values[index * 3 + 2]
    ];
  }

  col(index: number): number[] {
    return [
      this.values[index],
      this.values[index + 3],
      this.values[index + 6]
    ];
  }

  equals(matrix: Mat3, threshold = EPSILON): boolean {
    for (let i = 0; i < 9; i++) {
      if (Math.abs(this.values[i] - matrix.at(i)) > threshold) {
        return false;
      }
    }

    return true;
  }

  determinant(): number {
    const a00 = this.values[0], a01 = this.values[1], a02 = this.values[2],
      a10 = this.values[3], a11 = this.values[4], a12 = this.values[5],
      a20 = this.values[6], a21 = this.values[7], a22 = this.values[8];

    const det01 = a22 * a11 - a12 * a21,
      det11 = -a22 * a10 + a12 * a20,
      det21 = a21 * a10 - a11 * a20;

    return a00 * det01 + a01 * det11 + a02 * det21;
  }

  setIdentity(): Mat3 {
    this.values[0] = 1;
    this.values[1] = 0;
    this.values[2] = 0;
    this.values[3] = 0;
    this.values[4] = 1;
    this.values[5] = 0;
    this.values[6] = 0;
    this.values[7] = 0;
    this.values[8] = 1;

    return this;
  }

  transpose(): Mat3 {
    const temp01 = this.values[1],
      temp02 = this.values[2],
      temp12 = this.values[5];

    this.values[1] = this.values[3];
    this.values[2] = this.values[6];
    this.values[3] = temp01;
    this.values[5] = this.values[7];
    this.values[6] = temp02;
    this.values[7] = temp12;

    return this;
  }

  inverse(): Mat3 {
    const a00 = this.values[0], a01 = this.values[1], a02 = this.values[2],
      a10 = this.values[3], a11 = this.values[4], a12 = this.values[5],
      a20 = this.values[6], a21 = this.values[7], a22 = this.values[8];

    const det01 = a22 * a11 - a12 * a21,
      det11 = -a22 * a10 + a12 * a20,
      det21 = a21 * a10 - a11 * a20;

    let det = a00 * det01 + a01 * det11 + a02 * det21;

    if (!det) {
      return null;
    }

    det = 1.0 / det;

    this.values[0] = det01 * det;
    this.values[1] = (-a22 * a01 + a02 * a21) * det;
    this.values[2] = (a12 * a01 - a02 * a11) * det;
    this.values[3] = det11 * det;
    this.values[4] = (a22 * a00 - a02 * a20) * det;
    this.values[5] = (-a12 * a00 + a02 * a10) * det;
    this.values[6] = det21 * det;
    this.values[7] = (-a21 * a00 + a01 * a20) * det;
    this.values[8] = (a11 * a00 - a01 * a10) * det;

    return this;
  }

  multiply(matrix: Mat3): Mat3 {
    const a00 = this.values[0], a01 = this.values[1], a02 = this.values[2],
      a10 = this.values[3], a11 = this.values[4], a12 = this.values[5],
      a20 = this.values[6], a21 = this.values[7], a22 = this.values[8];

    const b00 = matrix.at(0), b01 = matrix.at(1), b02 = matrix.at(2),
      b10 = matrix.at(3), b11 = matrix.at(4), b12 = matrix.at(5),
      b20 = matrix.at(6), b21 = matrix.at(7), b22 = matrix.at(8);

    this.values[0] = b00 * a00 + b01 * a10 + b02 * a20;
    this.values[1] = b00 * a01 + b01 * a11 + b02 * a21;
    this.values[2] = b00 * a02 + b01 * a12 + b02 * a22;

    this.values[3] = b10 * a00 + b11 * a10 + b12 * a20;
    this.values[4] = b10 * a01 + b11 * a11 + b12 * a21;
    this.values[5] = b10 * a02 + b11 * a12 + b12 * a22;

    this.values[6] = b20 * a00 + b21 * a10 + b22 * a20;
    this.values[7] = b20 * a01 + b21 * a11 + b22 * a21;
    this.values[8] = b20 * a02 + b21 * a12 + b22 * a22;

    return this;
  }
}
