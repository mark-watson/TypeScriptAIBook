# Makefile for typescript_ui_experiments

.PHONY: clean help

clean:                                                                                                                                                   
	@echo "Cleaning up project directories.."
	for dir in *-app; do rm -rf $$dir/node_modules; rm -rf $$dir/dist $$dir/dist-ssr; rm -rf $$dir/src-tauri/target; done


help:
	@echo "Available targets:"
	@echo "  clean    - Clean up build artifacts, dependency directories, and editor backup files"
