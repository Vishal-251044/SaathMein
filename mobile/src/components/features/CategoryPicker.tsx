/**
 * CategoryPicker — multi-select of what the user plans to buy, grouped by top category
 * (Vehicles, Electronics, Home, ...). Names follow the UI language.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import type { CategoryGroup } from '@/types/catalog';
import { categoryIcon } from '@/utils/categoryIcons';
import { localizedName } from '@/utils/localize';

interface CategoryPickerProps {
  groups: CategoryGroup[];
  selectedIds: string[];
  onToggle: (categoryId: string) => void;
}

/**
 * @param props.groups - Category tree from the API
 * @param props.selectedIds - Chosen leaf category ids
 * @param props.onToggle - Called with the tapped category id
 */
export function CategoryPicker({ groups, selectedIds, onToggle }: CategoryPickerProps) {
  const { i18n } = useTranslation();

  return (
    <View className="gap-5">
      {groups.map((group) => (
        <View key={group.id} className="gap-3">
          <AppText variant="label">{localizedName(group, i18n.language)}</AppText>
          <View className="flex-row flex-wrap gap-2">
            {group.children.map((category) => (
              <Chip
                key={category.id}
                label={localizedName(category, i18n.language)}
                icon={categoryIcon(category.icon)}
                selected={selectedIds.includes(category.id)}
                onPress={() => onToggle(category.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
