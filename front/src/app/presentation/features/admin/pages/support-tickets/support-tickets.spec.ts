import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportTickets } from './support-tickets';

describe('SupportTickets', () => {
  let component: SupportTickets;
  let fixture: ComponentFixture<SupportTickets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportTickets]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportTickets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
