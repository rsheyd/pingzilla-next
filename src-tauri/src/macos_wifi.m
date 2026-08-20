#import <CoreLocation/CoreLocation.h>
#import <CoreWLAN/CoreWLAN.h>
#import <dispatch/dispatch.h>
#include <stdbool.h>
#include <string.h>

static CLLocationManager *pingzillaLocationManager;

void pingzilla_request_location_access(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (pingzillaLocationManager == nil) {
            pingzillaLocationManager = [[CLLocationManager alloc] init];
        }
        [pingzillaLocationManager requestWhenInUseAuthorization];
    });
}

bool pingzilla_copy_current_bssid(char *buffer, size_t buffer_length) {
    if (buffer == NULL || buffer_length == 0) {
        return false;
    }

    NSString *bssid = [[[CWWiFiClient sharedWiFiClient] interface] bssid];
    if (bssid == nil) {
        buffer[0] = '\0';
        return false;
    }

    const char *utf8 = [bssid UTF8String];
    if (utf8 == NULL) {
        buffer[0] = '\0';
        return false;
    }

    strlcpy(buffer, utf8, buffer_length);
    return true;
}
