import {Component, Input} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'app-preview-object',
  templateUrl: './preview-object.component.html',
  styleUrls: ['./preview-object.component.scss']
})
export class PreviewObjectComponent {
  @Input()
  public object: any;
  public expand = false;

  constructor(private sanitizer: DomSanitizer) {
  }

  public isPrimitive(obj: any): boolean {
    return ['string', 'number', 'boolean'].indexOf(typeof obj) !== -1;
  }

  public colorClass(obj: any): string {
    if (typeof obj === 'string' && (obj as string).startsWith('base64:')) {
      return 'binary';
    }
    return typeof obj;
  }

  public isType(obj: any, entries: Array<string>): boolean {
    if (!obj) {
      return false;
    }
    for (const entry of entries) {
      if (!obj.hasOwnProperty(entry)) {
        return false;
      }
    }
    for (const entry of obj) {
      if (obj.hasOwnProperty(entry)) {
        if (entries.indexOf(entry) === -1) {
          return false;
        }
      }
    }
    return true;
  }

  public isImage(obj: any): boolean {
    return this.isType(obj, ['image', 'name']);
  }

  public isFile(obj: any): boolean {
    return this.isType(obj, ['file', 'name']);
  }

  public isColor(obj: any): boolean {
    return this.isType(obj, ['red', 'green', 'blue']);
  }

  public colorHex(obj: any): string {
    const rgbToHex = function (rgb) {
      let hex = Number(rgb).toString(16);
      if (hex.length < 2) {
        hex = '0' + hex;
      }
      return hex;
    };

    return '#' +
      rgbToHex(Math.floor(obj.red / 256)) +
      rgbToHex(Math.floor(obj.green / 256)) +
      rgbToHex(Math.floor(obj.blue / 256));
  }

  public colorRGB48(obj: any): string {
    return `R: ${Math.floor(obj.red)}, G: ${Math.floor(obj.green)}, B: ${Math.floor(obj.blue)}`;
  }

  public colorStyle(obj): any {
    return {
      'background-color': `rgb(${obj.red / 255}, ${obj.green / 255}, ${obj.blue / 255})`
    };
  }

  public imageSrc(obj: any): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + (obj as string).substr(7));
  }

  public fileDownload(file: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + file.substr(7));
  }

  public isStream(obj: any): boolean {
    return Array.isArray(obj);
  }

  public isMap(obj: any): boolean {
    return !this.isImage(obj) && !this.isFile(obj) && !this.isColor(obj) && !Array.isArray(obj) && typeof obj === 'object';
  }

  public toString(obj: any): string {
    const str = obj.toString();
    if (str.length < 64) {
      return str;
    }
    return `${str.substr(0, 40)}... (${str.length})`;
  }
}

