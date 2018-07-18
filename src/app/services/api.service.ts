import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable()
export class ApiService {

  private baseUrl = 'http://localhost:5149/';

  constructor(private http: HttpClient) {
  }

  public async get(path: string, getParams?: any): Promise<Object> {
    return await this.http.get(this.baseUrl + path, {
      params: getParams
    }).toPromise();
  }

  public async post(path: string, getParams: any, postData: any): Promise<Object> {
    return await this.http.post(this.baseUrl + path, postData, {
      params: getParams,
      responseType: 'json'
    }).toPromise();
  }

}
