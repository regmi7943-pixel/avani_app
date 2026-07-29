import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DynamicUIBlock {
  type: 'heading' | 'paragraph' | 'badge' | 'kv_table' | 'bullet_list' | 'warning_box';
  title?: string;
  text?: string;
  color?: string;
  items?: string[];
  pairs?: { label: string; value: string }[];
}

interface DynamicAIVideoCardProps {
  blocks?: DynamicUIBlock[];
  isDarkMode: boolean;
  colors: any;
}

/**
 * Dynamic AI Component Interpreter
 * Safely renders dynamic visual layouts constructed by Grok AI without security risks or runtime crashes.
 */
export const DynamicAIVideoCard: React.FC<DynamicAIVideoCardProps> = ({ blocks, isDarkMode, colors }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <View key={idx} style={styles.headingRow}>
                <Ionicons name="sparkles" size={16} color={colors.brandGreen} />
                <Text style={[styles.headingText, { color: colors.text }]}>{block.title || block.text}</Text>
              </View>
            );

          case 'badge':
            return (
              <View key={idx} style={[styles.badgeContainer, { backgroundColor: block.color || colors.brandGreen + '20' }]}>
                <Text style={[styles.badgeText, { color: block.color || colors.brandGreen }]}>{block.text}</Text>
              </View>
            );

          case 'paragraph':
            return (
              <Text key={idx} style={[styles.paragraphText, { color: colors.text }]}>
                {block.text}
              </Text>
            );

          case 'bullet_list':
            return (
              <View key={idx} style={styles.listContainer}>
                {block.items?.map((item, itemIdx) => (
                  <View key={itemIdx} style={styles.bulletRow}>
                    <Text style={{ color: colors.brandGreen, fontWeight: '800' }}>•</Text>
                    <Text style={[styles.bulletText, { color: colors.text }]}>{item}</Text>
                  </View>
                ))}
              </View>
            );

          case 'kv_table':
            return (
              <View key={idx} style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {block.pairs?.map((pair, pIdx) => (
                  <View key={pIdx} style={[styles.tableRow, { borderBottomWidth: pIdx === (block.pairs?.length || 0) - 1 ? 0 : 1, borderBottomColor: colors.border }]}>
                    <Text style={[styles.tableLabel, { color: colors.secondaryText }]}>{pair.label}</Text>
                    <Text style={[styles.tableValue, { color: colors.text }]}>{pair.value}</Text>
                  </View>
                ))}
              </View>
            );

          case 'warning_box':
            return (
              <View key={idx} style={[styles.warningBox, { backgroundColor: isDarkMode ? '#2b1e1e' : '#fff3f3', borderColor: '#E53935' }]}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning-outline" size={18} color="#E53935" />
                  <Text style={styles.warningTitle}>{block.title || 'Important Notice'}</Text>
                </View>
                {block.items?.map((item, wIdx) => (
                  <Text key={wIdx} style={[styles.warningText, { color: colors.text }]}>• {item}</Text>
                ))}
              </View>
            );

          default:
            return null;
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headingText: {
    fontSize: 15,
    fontWeight: '800',
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paragraphText: {
    fontSize: 13,
    lineHeight: 20,
  },
  listContainer: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tableLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  tableValue: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  warningBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#E53935',
  },
  warningText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
