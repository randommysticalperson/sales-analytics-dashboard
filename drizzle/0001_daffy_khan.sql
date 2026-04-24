CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`industry` varchar(128),
	`website` varchar(256),
	`size` enum('1-10','11-50','51-200','201-1000','1000+') DEFAULT '1-10',
	`annualRevenue` decimal(15,2),
	`country` varchar(128),
	`city` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('note','call','email','meeting','task') NOT NULL DEFAULT 'note',
	`title` varchar(256) NOT NULL,
	`description` text,
	`dealId` int,
	`contactId` int,
	`repId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`email` varchar(320),
	`phone` varchar(64),
	`title` varchar(128),
	`accountId` int,
	`assignedRepId` int,
	`status` enum('active','inactive','prospect') NOT NULL DEFAULT 'prospect',
	`source` enum('inbound','outbound','referral','event','other') DEFAULT 'other',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`contactId` int,
	`accountId` int,
	`assignedRepId` int,
	`value` decimal(15,2) NOT NULL DEFAULT '0',
	`stage` enum('lead','qualified','proposal','negotiation','closed_won','closed_lost') NOT NULL DEFAULT 'lead',
	`probability` int DEFAULT 10,
	`expectedCloseDate` date,
	`actualCloseDate` date,
	`lostReason` varchar(256),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_reps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(128) NOT NULL,
	`email` varchar(320),
	`avatarInitials` varchar(4),
	`avatarColor` varchar(32),
	`title` varchar(128),
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_reps_id` PRIMARY KEY(`id`)
);
