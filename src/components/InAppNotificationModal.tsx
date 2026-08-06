import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InAppNotificationItem } from '../services/cropLifecycleService';

interface InAppNotificationModalProps {
  visible: boolean;
  notifications: InAppNotificationItem[];
  onClose: () => void;
}

export default function InAppNotificationModal({
  visible,
  notifications,
  onClose,
}: InAppNotificationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications-outline" size={22} color="#1c3a27" />
              <Text style={styles.titleText}>In-App Notifications</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#666c5d" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={44} color="#6B8F5E" />
                <Text style={styles.emptyTitle}>All Up to Date!</Text>
                <Text style={styles.emptySub}>No pending weeding or planting alerts for your fields.</Text>
              </View>
            ) : (
              notifications.map((notif) => {
                const isPlant = notif.type === 'confirm_planting';
                const isWeed = notif.type === 'confirm_weeding';

                return (
                  <View key={notif.id} style={styles.notifCard}>
                    <View
                      style={[
                        styles.notifIconCircle,
                        { backgroundColor: isPlant ? '#ebf3ef' : isWeed ? '#fff0e6' : '#ebf7ee' },
                      ]}
                    >
                      <Ionicons
                        name={isPlant ? 'leaf-outline' : isWeed ? 'cut-outline' : 'trophy-outline'}
                        size={20}
                        color={isPlant ? '#1c3a27' : isWeed ? '#c9622a' : '#2e5d3b'}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifDate}>{notif.date}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close Notifications</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1c231b',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f4f2ec',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1c231b',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#666c5d',
    marginTop: 4,
  },
  notifCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#fdfdfc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6e2d3',
    marginBottom: 10,
  },
  notifIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1c231b',
  },
  notifMessage: {
    fontSize: 12,
    color: '#666c5d',
    marginTop: 2,
    lineHeight: 17,
  },
  notifDate: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c9622a',
    marginTop: 4,
  },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1c3a27',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
