import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FieldLifecycleState } from '../services/cropLifecycleService';

interface CropLifecycleCheckinModalProps {
  visible: boolean;
  item: FieldLifecycleState | null;
  onConfirm: () => void;
  onDismiss: () => void;
  onNotYet?: () => void;
}

export default function CropLifecycleCheckinModal({
  visible,
  item,
  onConfirm,
  onDismiss,
  onNotYet,
}: CropLifecycleCheckinModalProps) {
  if (!item || !item.pendingCheckin) return null;

  const { pendingCheckin } = item;
  const isPlanting = pendingCheckin.type === 'confirm_planting';
  const isWeeding = pendingCheckin.type === 'confirm_weeding';
  const isHarvest = pendingCheckin.type === 'confirm_harvest';

  const badgeColor = isPlanting ? '#1c3a27' : isWeeding ? '#c9622a' : '#2e5d3b';
  const badgeBg = isPlanting ? '#ebf3ef' : isWeeding ? '#fff0e6' : '#ebf7ee';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Banner Icon */}
          <View style={[styles.topIconCircle, { backgroundColor: badgeBg }]}>
            <Ionicons
              name={isPlanting ? 'leaf-outline' : isWeeding ? 'cut-outline' : 'trophy-outline'}
              size={32}
              color={badgeColor}
            />
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
            <Ionicons name="close" size={20} color="#666c5d" />
          </TouchableOpacity>

          {/* Title & Message */}
          <Text style={styles.titleText}>{pendingCheckin.title}</Text>

          <View style={styles.cropBadgeRow}>
            <Text style={styles.cropBadgeText}>CROP: {item.crop_type.toUpperCase()}</Text>
          </View>

          <Text style={styles.messageText}>{pendingCheckin.message}</Text>

          {/* Estimated Harvest Suggestion Card */}
          {pendingCheckin.suggestedHarvestDate && (
            <View style={styles.harvestCard}>
              <View style={styles.harvestCardHeader}>
                <Ionicons name="calendar-outline" size={16} color="#1c3a27" />
                <Text style={styles.harvestCardTitle}>Estimated Harvest Date</Text>
              </View>
              <Text style={styles.harvestDateText}>
                {new Date(pendingCheckin.suggestedHarvestDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.harvestSubText}>
                {isHarvest ? 'Maturity reached! Ready for harvest.' : `Estimated duration: ~${item.days_to_harvest} days remaining`}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onNotYet || onDismiss}>
              <Text style={styles.dismissBtnText}>Not Yet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: badgeColor }]} onPress={onConfirm}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>
                {isPlanting ? 'Yes, Planted!' : isWeeding ? 'Yes, Weeding Done!' : 'Mark Harvested!'}
              </Text>
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
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  topIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f4f2ec',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1c231b',
    textAlign: 'center',
    marginBottom: 6,
  },
  cropBadgeRow: {
    backgroundColor: '#f4f2ec',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  cropBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1c3a27',
    letterSpacing: 0.6,
  },
  messageText: {
    fontSize: 13,
    color: '#666c5d',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  harvestCard: {
    width: '100%',
    backgroundColor: '#ebf3ef',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf2ca',
    alignItems: 'center',
    marginBottom: 20,
  },
  harvestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  harvestCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1c3a27',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  harvestDateText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1c231b',
  },
  harvestSubText: {
    fontSize: 11,
    color: '#666c5d',
    marginTop: 2,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f4f2ec',
    borderWidth: 1,
    borderColor: '#e6e2d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#666c5d',
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
