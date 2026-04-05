import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentedControlComponent } from './segmented-control.component';

describe('SegmentedControlComponent', () => {
  let component: SegmentedControlComponent;
  let fixture: ComponentFixture<SegmentedControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SegmentedControlComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SegmentedControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit valueChange when a different option is selected', () => {
    component.options = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    component.value = 'a';

    const emitted: string[] = [];
    component.valueChange.subscribe((v: string) => emitted.push(v));

    component.select('b');
    expect(emitted).toEqual(['b']);
  });

  it('should not emit valueChange when the same option is selected', () => {
    component.options = [{ id: 'a', label: 'A' }];
    component.value = 'a';

    const emitted: string[] = [];
    component.valueChange.subscribe((v: string) => emitted.push(v));

    component.select('a');
    expect(emitted).toEqual([]);
  });
});
