import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkFilterPills } from './network-filter-pills';

describe('NetworkFilterPills', () => {
  let component: NetworkFilterPills;
  let fixture: ComponentFixture<NetworkFilterPills>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkFilterPills]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkFilterPills);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
