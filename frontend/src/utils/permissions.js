import { PermissionsAndroid, Platform, Alert } from 'react-native';

export const requestP2PPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    try {
        const permissions = [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
            PermissionsAndroid.PERMISSIONS.SEND_SMS,
            PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
            status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
            Alert.alert(
                'Permissions Required',
                'This app needs Bluetooth, Location, and SMS permissions to work offline. Please enable them in settings.'
            );
            return false;
        }

        return true;
    } catch (err) {
        console.warn('Permission request error:', err);
        return false;
    }
};
