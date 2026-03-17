SHELL := bash

.PHONY: fork stop test install dev build help

## Start Anvil fork with all state changes applied
fork:
	@$(MAKE) -C foundry fork

## Stop background Anvil
stop:
	@$(MAKE) -C foundry stop

## Run Forge tests against the fork
test:
	@$(MAKE) -C foundry test

## Install all dependencies (foundry + frontend)
install:
	@echo "Installing Foundry dependencies..."
	@cd foundry && forge install
	@echo ""
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo ""
	@echo "Done! Run 'make fork' to start the local fork."

## Start the frontend dev server (requires fork running)
dev:
	@cd frontend && npm run dev

## Build the frontend for production
build:
	@cd frontend && npm run build

## Fund an address with KAT on the running fork
fund:
	@$(MAKE) -C foundry fund ADDR=$(ADDR) AMOUNT=$(AMOUNT)

## Fast-forward time on the fork
warp:
	@$(MAKE) -C foundry warp DAYS=$(DAYS)

## Check KAT balances on the fork
balances:
	@$(MAKE) -C foundry balances

## Show help
help:
	@echo "Katana Fork - Test your dapps locally"
	@echo ""
	@echo "Quick start:"
	@echo "  make install       Install all dependencies"
	@echo "  make fork          Start Anvil fork (background)"
	@echo "  make dev           Start frontend dev server"
	@echo ""
	@echo "Testing:"
	@echo "  make test          Run Forge tests"
	@echo ""
	@echo "Utilities:"
	@echo "  make fund ADDR=0x... AMOUNT=10000   Fund address with KAT"
	@echo "  make warp DAYS=45                   Fast-forward time"
	@echo "  make balances                       Check KAT balances"
	@echo "  make stop                           Stop Anvil"
	@echo ""
	@echo "Wallets (Anvil defaults):"
	@echo "  Alice: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	@echo "  Bob:   0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
	@echo "  Carol: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
