SHELL := bash

FORK_BLOCK ?= latest
FORK_RPC   ?= https://rpc.katana.network
CHAIN_ID   := 747474
ANVIL_PORT ?= 8545
RPC_URL    := http://127.0.0.1:$(ANVIL_PORT)

PID_FILE := .anvil.pid
LOG_FILE := .anvil.log

.PHONY: fork anvil setup stop fund warp time gauge gauges test balances help

FORK_BLOCK_FLAG := $(if $(filter latest,$(FORK_BLOCK)),,--fork-block-number $(FORK_BLOCK))

fork: stop
	@echo "Starting Anvil fork ($(FORK_BLOCK))..."
	@anvil \
		--fork-url $(FORK_RPC) \
		$(FORK_BLOCK_FLAG) \
		--chain-id $(CHAIN_ID) \
		--port $(ANVIL_PORT) \
		--auto-impersonate \
		> $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE)
	@sleep 4
	@$(MAKE) setup --no-print-directory
	@echo ""
	@echo "Anvil running (PID $$(cat $(PID_FILE))) on port $(ANVIL_PORT)"

anvil:
	anvil \
		--fork-url $(FORK_RPC) \
		$(FORK_BLOCK_FLAG) \
		--chain-id $(CHAIN_ID) \
		--port $(ANVIL_PORT) \
		--auto-impersonate

setup:
	@bash script/setup-anvil.sh $(RPC_URL)

stop:
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		echo "Anvil stopped."; \
	fi

fund:
ifndef ADDR
	$(error Usage: make fund ADDR=0x... [AMOUNT=10000])
endif
	$(eval AMT := $(or $(AMOUNT),10000))
	$(eval HEX_VAL := $(shell python3 -c "print('0x' + format($(AMT) * 10**18, '064x'))"))
	$(eval BAL_SLOT := $(shell cast index address $(ADDR) 0))
	@cast rpc anvil_setStorageAt 0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d \
		$(BAL_SLOT) $(HEX_VAL) --rpc-url $(RPC_URL) > /dev/null
	@cast send 0x106F7D67Ea25Cb9eFf5064CF604ebf6259Ff296d \
		"setApprovalForAll(address,bool)" 0x4d6fC15Ca6258b168225D283262743C623c13Ead true \
		--from $(ADDR) --unlocked --rpc-url $(RPC_URL) > /dev/null
	@echo "$(ADDR) funded with $(AMT) KAT"

warp:
ifndef DAYS
	$(error Usage: make warp DAYS=45)
endif
	$(eval CURRENT := $(shell cast block latest --field timestamp --rpc-url $(RPC_URL) | awk '{print $$1}'))
	$(eval SECONDS := $(shell python3 -c "print($(DAYS) * 86400)"))
	$(eval TARGET := $(shell python3 -c "print($(CURRENT) + $(SECONDS))"))
	$(eval HEX_TARGET := $(shell python3 -c "print(hex($(TARGET)))"))
	@cast rpc evm_setNextBlockTimestamp $(HEX_TARGET) --rpc-url $(RPC_URL) > /dev/null
	@cast rpc evm_mine --rpc-url $(RPC_URL) > /dev/null
	@echo "Warped $(DAYS) days forward"

time:
	@echo -n "Block: " && cast block latest --field number --rpc-url $(RPC_URL)
	@echo -n "Timestamp: " && cast block latest --field timestamp --rpc-url $(RPC_URL)

balances:
	@echo "KAT Balances:"
	@echo -n "  Alice: " && cast call 0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d \
		"balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url $(RPC_URL)
	@echo -n "  Bob:   " && cast call 0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d \
		"balanceOf(address)(uint256)" 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --rpc-url $(RPC_URL)
	@echo -n "  Carol: " && cast call 0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d \
		"balanceOf(address)(uint256)" 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC --rpc-url $(RPC_URL)

test:
	forge test -vv

help:
	@echo "KAT Fork - Foundry"
	@echo ""
	@echo "  make fork          Start Anvil + apply setup"
	@echo "  make stop          Stop Anvil"
	@echo "  make test          Run Forge tests"
	@echo "  make fund ADDR=0x...  Fund address with KAT"
	@echo "  make warp DAYS=45  Fast-forward time"
	@echo "  make balances      Check KAT balances"
