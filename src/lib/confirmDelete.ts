import { Alert } from 'react-native';

/** Confirma exclusão destrutiva (padrão Capim). */
export function confirmDelete(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
): void {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Excluir',
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
