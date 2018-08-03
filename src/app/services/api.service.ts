import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable()
export class ApiService {
  private static host = 'http://localhost:5149';

  constructor(private http: HttpClient) {
  }

  public async get(path: string, getParams?: any): Promise<Object> {
    return await this.http.get(ApiService.host + path, {
      params: getParams
    }).toPromise();
  }

  public async post(path: string, getParams: any, postData: any): Promise<Object> {
    return await this.http.post(ApiService.host + path, postData, {
      params: getParams,
      responseType: 'json'
    }).toPromise();
  }

}
