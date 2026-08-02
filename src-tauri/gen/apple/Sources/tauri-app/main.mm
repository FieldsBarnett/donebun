#include "bindings/bindings.h"

extern "C" void donebun_install_url_catcher(void);

int main(int argc, char * argv[]) {
	// Capture donebun:// Links (widget calendar days) into App Group before Tauri boots.
	donebun_install_url_catcher();
	ffi::start_app();
	return 0;
}
