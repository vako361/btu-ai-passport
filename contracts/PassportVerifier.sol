// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PassportVerifier {
    address public owner;

    struct PassportRecord {
        string passportId;
        string verificationId;
        bytes32 docHash;
        uint256 version;
        uint256 timestamp;
        bool isLatest;
    }

    mapping(string => PassportRecord) public recordsByVerificationId;

    event PassportRegistered(string passportId, string verificationId, bytes32 docHash, uint256 version);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only BTU can register passports");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerPassport(
        string memory _passportId,
        string memory _verificationId,
        bytes32 _docHash,
        uint256 _version,
        string memory _previousVerificationId
    ) external onlyOwner {
        require(bytes(_passportId).length > 0, "Passport ID is required");
        require(bytes(_verificationId).length > 0, "Verification ID is required");
        require(_docHash != bytes32(0), "Document hash is required");

        PassportRecord storage existing = recordsByVerificationId[_verificationId];
        if (existing.timestamp > 0) {
            require(
                keccak256(bytes(existing.passportId)) == keccak256(bytes(_passportId)) &&
                    existing.docHash == _docHash &&
                    existing.version == _version,
                "Verification ID conflicts with existing record"
            );
            return;
        }

        if (bytes(_previousVerificationId).length > 0) {
            PassportRecord storage previous = recordsByVerificationId[_previousVerificationId];
            require(previous.timestamp > 0, "Previous version does not exist");
            require(previous.isLatest, "Previous version is not latest");
            require(
                keccak256(bytes(previous.passportId)) == keccak256(bytes(_passportId)),
                "Previous version belongs to another passport"
            );
            require(_version == previous.version + 1, "Version must increment by one");
            previous.isLatest = false;
        } else {
            require(_version == 1, "Initial version must be one");
        }

        recordsByVerificationId[_verificationId] = PassportRecord({
            passportId: _passportId,
            verificationId: _verificationId,
            docHash: _docHash,
            version: _version,
            timestamp: block.timestamp,
            isLatest: true
        });

        emit PassportRegistered(_passportId, _verificationId, _docHash, _version);
    }

    function getPassport(string memory _verificationId) external view returns (PassportRecord memory) {
        return recordsByVerificationId[_verificationId];
    }
}