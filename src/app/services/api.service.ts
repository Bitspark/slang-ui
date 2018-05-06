import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable()
export class ApiService {

  private baseUrl = 'http://localhost:5149/';

  constructor(private http: HttpClient) {
  }

  public async get(path: string, params: any): Promise<Object> {
    return await this.http.get(this.baseUrl + path, {
      params: params
    }).toPromise();
  }

}
