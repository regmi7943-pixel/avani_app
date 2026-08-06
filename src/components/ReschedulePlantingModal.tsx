import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEstimatedHarvestDuration } from '../services/cropLifecycleService';

const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type MilestoneType = 'confirm_planting' | 'confirm_weeding' | 'confirm_harvest';

interface ReschedulePlantingModalProps {
  visible: boolean;
  fieldName?: string;
  cropType?: string;
  plantingDate?: string | null;
  currentDate?: string | null;
  simulatedDate?: string | null;
  milestoneType: MilestoneType;
  onSave: (dateStr: string) => void;
  onCancel: () => void;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export default function ReschedulePlantingModal({
  visible,
  fieldName,
  cropType,
  plantingDate,
  currentDate,
  simulatedDate,
  milestoneType,
  onSave,
  onCancel,
}: ReschedulePlantingModalProps) {
  const isWeeding = milestoneType === 'confirm_weeding';
  const isHarvest = milestoneType === 'confirm_harvest';

  // ── Valid period for the milestone (only these dates are selectable) ──
  const period = useMemo(() => {
    const base = plantingDate ? new Date(plantingDate) : null;
    if (!base || isNaN(base.getTime())) return null;
    const p = startOfDay(base);
    if (isHarvest) {
      const dur = getEstimatedHarvestDuration(cropType || 'Rice');
      return { min: addDays(p, dur - 10), max: addDays(p, dur) };
    }
    if (isWeeding) {
      return { min: addDays(p, 15), max: addDays(p, 45) };
    }
    return { min: p, max: null as Date | null };
  }, [plantingDate, cropType, isWeeding, isHarvest]);

  const clampToPeriod = (d: Date | null): Date | null => {
    if (!d || !period || isNaN(d.getTime())) return null;
    const clamped = startOfDay(d);
    if (clamped < period.min) return period.min;
    if (period.max && clamped > period.max) return period.max;
    return clamped;
  };

  // Pre-select the simulated clock date (falls back to the milestone date, clamped into the valid period)
  const initialSel =
    clampToPeriod(simulatedDate ? new Date(simulatedDate) : null) ||
    clampToPeriod(currentDate ? new Date(currentDate) : new Date()) ||
    (period ? period.min : new Date());
  const [viewYear, setViewYear] = useState(initialSel.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialSel.getMonth());
  const [selYear, setSelYear] = useState(initialSel.getFullYear());
  const [selMonth, setSelMonth] = useState(initialSel.getMonth());
  const [selDay, setSelDay] = useState(initialSel.getDate());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isInPeriod = (y: number, m: number, d: number): boolean => {
    if (!period) return true;
    const date = new Date(y, m, d);
    if (date < period.min) return false;
    if (period.max && date > period.max) return false;
    return true;
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const selectedStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;

  const title = isWeeding
    ? 'When will you complete weeding?'
    : isHarvest
      ? 'When are you planning to harvest?'
      : 'When are you going to plant?';

  const subText = isWeeding
    ? `"${fieldName || 'The field'}" (${cropType || 'Crop'}) needs first-round weeding & fertilizer. Pick a date within the weeding period — we'll ask again once that date arrives.`
    : isHarvest
      ? `"${fieldName || 'The field'}" (${cropType || 'Crop'}) is ready to harvest. Pick a date within the harvest window — we'll ask again once that date arrives.`
      : `"${fieldName || 'The field'}" (${cropType || 'Crop'}) isn't planted yet. Pick a new planting date — we'll ask you again once that date arrives.`;

  const periodLabel = period
    ? isHarvest
      ? `Harvest window: ${FULL_MONTH_NAMES[period.min.getMonth()]} ${period.min.getDate()} – ${FULL_MONTH_NAMES[period.max!.getMonth()]} ${period.max!.getDate()}, ${period.max!.getFullYear()}`
      : isWeeding
        ? `Weeding period: ${FULL_MONTH_NAMES[period.min.getMonth()]} ${period.min.getDate()} – ${FULL_MONTH_NAMES[period.max!.getMonth()]} ${period.max!.getDate()}, ${period.max!.getFullYear()}`
        : `Planting from ${FULL_MONTH_NAMES[period.min.getMonth()]} ${period.min.getDate()}, ${period.min.getFullYear()} onward`
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar-outline" size={28} color="#1c3a27" />
          </View>

          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.subText}>{subText}</Text>

          {periodLabel ? (
            <View style={styles.currentDateChip}>
              <Text style={styles.currentDateLabel}>
                {isWeeding ? 'VALID WEEDING PERIOD' : isHarvest ? 'VALID HARVEST WINDOW' : 'EARLIEST PLANTING DATE'}
              </Text>
              <Text style={styles.currentDateValue}>{periodLabel}</Text>
            </View>
          ) : null}

          {/* Calendar */}
          <View style={styles.calendar}>
            <View style={styles.calHeader}>
              <TouchableOpacity style={styles.calNavBtn} onPress={goPrevMonth} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={18} color="#1c231b" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.calMonthText}>
                  {FULL_MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <Text style={styles.calMonthHint}>Only dates in the {isHarvest ? 'harvest window' : isWeeding ? 'weeding period' : 'valid range'} can be picked</Text>
              </View>
              <TouchableOpacity style={styles.calNavBtn} onPress={goNextMonth} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={18} color="#1c231b" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_HEADERS.map((w, i) => (
                <Text key={i} style={styles.weekHeader}>{w}</Text>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              <View style={styles.dayGrid}>
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <View key={`b${idx}`} style={styles.dayCell} />;
                  }
                  const enabled = isInPeriod(viewYear, viewMonth, day);
                  const isSelected =
                    enabled &&
                    selYear === viewYear &&
                    selMonth === viewMonth &&
                    selDay === day;
                  const isToday =
                    new Date().getFullYear() === viewYear &&
                    new Date().getMonth() === viewMonth &&
                    new Date().getDate() === day;
                  return (
                    <TouchableOpacity
                      key={`d${idx}`}
                      disabled={!enabled}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        !enabled && styles.dayCellDisabled,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelYear(viewYear);
                        setSelMonth(viewMonth);
                        setSelDay(day);
                      }}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected, !enabled && styles.dayTextDisabled]}>
                        {day}
                      </Text>
                      {isToday && !isSelected && enabled && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Selected date preview */}
          <View style={styles.previewRow}>
            <Ionicons name="leaf-outline" size={16} color="#c9622a" />
            <Text style={styles.previewText}>
              {isWeeding ? 'Weeding date:' : isHarvest ? 'Harvest date:' : 'New planting date:'}{' '}
              <Text style={styles.previewDate}>
                {FULL_MONTH_NAMES[selMonth]} {selDay}, {selYear}
              </Text>
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(selectedStr)} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ebf3ef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1c231b',
    textAlign: 'center',
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: '#666c5d',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  currentDateChip: {
    backgroundColor: '#f4f2ec',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  currentDateLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8b9184',
    letterSpacing: 0.8,
  },
  currentDateValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1c3a27',
    marginTop: 2,
    textAlign: 'center',
  },
  calendar: {
    width: '100%',
    backgroundColor: '#fbfaf7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6e2d3',
    padding: 12,
    marginBottom: 12,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f4f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calMonthText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1c231b',
  },
  calMonthHint: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8b9184',
    marginTop: 1,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#b5b1a3',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 2,
    position: 'relative',
  },
  dayCellSelected: {
    backgroundColor: '#1c3a27',
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1c231b',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayTextDisabled: {
    color: '#b5b1a3',
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c9622a',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  previewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666c5d',
  },
  previewDate: {
    color: '#1c3a27',
    fontWeight: '900',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f4f2ec',
    borderWidth: 1,
    borderColor: '#e6e2d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#666c5d',
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1c3a27',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    elevation: 2,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
