import {
  Result,
  Repository,
  UseCase,
  Group,
  User,
  Service,
  PushNotificationSubscription,
} from '../../entities';
import { BadRequest, CustomError, UnExpectedError } from '../../errors';
import { SendPushNotifiactionUseCase } from '../SendPushNotificationUseCase';
import { isEqual } from '../../helpers';

export class CreateGroupUnitUseCase implements UseCase<Group> {
  constructor(
    private repository: Repository<Group>,
    private usersRepository: Repository<User>,
    private pushNotificationSubscriptionRepository: Repository<
      PushNotificationSubscription
    >,
    private service: Service
  ) {}

  async execute(familyUnit: Group): Promise<Result<Group>> {
    try {
      //Check if the family unit contains valid users (atleast always come with one user, the creator of the family unit)
      familyUnit.users.forEach(async (user) => {
        const userOnDb = await this.usersRepository.findOne(user.username!);
        if (!userOnDb)
          throw new BadRequest(`No user with username: ${user.username} found`);
      });

      //Check if the family unit already exists
      (await this.repository.findMany({})).forEach((group) => {
        if (isEqual(familyUnit.users, group.users))
          throw new BadRequest('This group already exists');
      });

      //Create the family unit
      const createdGroup = await this.repository.save(familyUnit);

      //Notify other users related to family unit (the first user of the array is always the creator so it hasn't to be notified)
      familyUnit.users.forEach(async (user, index) => {
        new SendPushNotifiactionUseCase(
          this.service,
          this.pushNotificationSubscriptionRepository
        ).execute(user.id!, {
          title: 'Shopping List',
          message: `${user.username} te han añadido a una unidad familiar`,
        });
      });

      return new Result<Group>([createdGroup]);
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new UnExpectedError(error.message);
    }
  }
}
