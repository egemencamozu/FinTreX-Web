import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HoldingsCardComponent } from './holdings-card.component';

describe('HoldingsCardComponent', () => {
  let component: HoldingsCardComponent;
  let fixture: ComponentFixture<HoldingsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoldingsCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldingsCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('viewOptions', [
      { id: 'history', label: 'History' },
      { id: 'allocation', label: 'Allocation' },
    ]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set first option as default active view', () => {
    expect(component.activeView()).toBe('history');
  });

  it('should switch active view', () => {
    component.setView('allocation');
    expect(component.activeView()).toBe('allocation');
  });

  it('should emit activeViewChange on setView', () => {
    const emitted: string[] = [];
    component.activeViewChange.subscribe((v: string) => emitted.push(v));
    component.setView('allocation');
    expect(emitted).toEqual(['allocation']);
  });
});
