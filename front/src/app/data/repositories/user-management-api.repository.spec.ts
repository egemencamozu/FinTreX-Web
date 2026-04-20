import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';
import { UserManagementApiRepository } from './user-management-api.repository';

describe('UserManagementApiRepository', () => {
  let repository: UserManagementApiRepository;
  let httpMock: HttpTestingController;

  const environmentConfigServiceMock = {
    get: jasmine.createSpy('get').and.callFake((key: string) => {
      if (key === 'apiBaseUrl') {
        return 'https://localhost:9001/api';
      }
      return '';
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserManagementApiRepository,
        { provide: EnvironmentConfigService, useValue: environmentConfigServiceMock },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    repository = TestBed.inject(UserManagementApiRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should normalize Message response for deactivate', () => {
    let result: { message: string } | undefined;

    repository.deactivateUser('user-1', 'ONE_WEEK').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://localhost:9001/api/v1/UserManagement/user-1/deactivate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ Message: 'User deactivated successfully' });

    expect(result).toEqual({ message: 'User deactivated successfully' });
  });

  it('should normalize lowercase message response for activate', () => {
    let result: { message: string } | undefined;

    repository.activateUser('user-1').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://localhost:9001/api/v1/UserManagement/user-1/activate');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'User activated successfully' });

    expect(result).toEqual({ message: 'User activated successfully' });
  });

  it('should fallback to default success message when action response is empty', () => {
    let result: { message: string } | undefined;

    repository.activateUser('user-2').subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne('https://localhost:9001/api/v1/UserManagement/user-2/activate');
    req.flush({});

    expect(result).toEqual({ message: 'Kullanici active edildi.' });
  });

  it('should convert network errors to a readable message', () => {
    let errorMessage = '';

    repository.getAllUsers().subscribe({
      next: () => fail('Expected request to fail'),
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    const req = httpMock.expectOne('https://localhost:9001/api/v1/UserManagement/users');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(errorMessage).toContain('Sunucuya baglanilamadi');
  });

  it('should prioritize backend message for server errors', () => {
    let errorMessage = '';

    repository.getAllUsers().subscribe({
      next: () => fail('Expected request to fail'),
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    const req = httpMock.expectOne('https://localhost:9001/api/v1/UserManagement/users');
    req.flush({ message: 'Yetkiniz yok.' }, { status: 403, statusText: 'Forbidden' });

    expect(errorMessage).toBe('Yetkiniz yok.');
  });
});

