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
        if (bytes(_previousVerificationId).length > 0) {
            recordsByVerificationId[_previousVerificationId].isLatest = false;
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